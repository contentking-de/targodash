import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAgentur } from "@/lib/rbac";
import { GoogleGenAI } from "@google/genai";
import { put, del } from "@vercel/blob";

// POST - Diagramm aus bodyContent generieren und in Vercel Blob speichern
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Nur Agentur-User können Diagramme generieren
    if (!isAgentur(user.role)) {
      return NextResponse.json({ error: "Nur für Agentur-Nutzer verfügbar" }, { status: 403 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API Key nicht konfiguriert" },
        { status: 500 }
      );
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Vercel Blob Token nicht konfiguriert" },
        { status: 500 }
      );
    }

    const { id } = await params;

    // Briefing laden
    const briefing = await prisma.briefing.findUnique({
      where: { id },
    });

    if (!briefing) {
      return NextResponse.json({ error: "Briefing nicht gefunden" }, { status: 404 });
    }

    // Prüfen ob bodyContent vorhanden ist
    if (!briefing.bodyContent) {
      return NextResponse.json(
        { error: "Kein Fliesstext/Struktur vorhanden. Bitte zuerst das Feld 'Fliesstext/Struktur' ausfüllen." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Prompt für die Bildgenerierung erstellen
    const imagePrompt = buildImagePrompt(briefing);

    // Bild mit Gemini 3 Pro Image generieren (optimiert für Text-Rendering in Diagrammen)
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: imagePrompt,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: "16:9", // Breites Format für Diagramme
          imageSize: "2K", // Hohe Auflösung für bessere Textlesbarkeit
        },
      },
    });

    // Bild aus der Antwort extrahieren (base64-codiert)
    let imageData: string | undefined;
    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          break;
        }
      }
    }

    if (!imageData) {
      return NextResponse.json(
        { error: "Fehler bei der Bildgenerierung - keine Bilddaten erhalten" },
        { status: 500 }
      );
    }

    // Base64 zu Buffer konvertieren
    const imageBuffer = Buffer.from(imageData, "base64");
    const imageBlob = new Blob([imageBuffer], { type: "image/png" });

    // Altes Diagramm löschen falls vorhanden
    if (briefing.diagramUrl) {
      try {
        await del(briefing.diagramUrl);
      } catch (deleteError) {
        console.error("Error deleting old diagram:", deleteError);
        // Weiter machen auch wenn Löschen fehlschlägt
      }
    }

    // Neues Bild in Vercel Blob speichern
    const filename = `briefings/${briefing.id}/diagram-${Date.now()}.png`;
    const blob = await put(filename, imageBlob, {
      access: "public",
      contentType: "image/png",
    });

    // Briefing mit neuer diagramUrl aktualisieren
    const updatedBriefing = await prisma.briefing.update({
      where: { id },
      data: { diagramUrl: blob.url },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      briefing: updatedBriefing,
      diagramUrl: blob.url,
    });
  } catch (error: any) {
    console.error("Error generating diagram:", error);
    const errorMessage = error?.message || error?.toString() || "Unbekannter Fehler";
    return NextResponse.json(
      { 
        error: "Fehler bei der Diagramm-Generierung",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

// PUT - Manuelles Diagramm hochladen
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Nur Agentur-User können Diagramme hochladen
    if (!isAgentur(user.role)) {
      return NextResponse.json({ error: "Nur für Agentur-Nutzer verfügbar" }, { status: 403 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Vercel Blob Token nicht konfiguriert" },
        { status: 500 }
      );
    }

    const { id } = await params;

    // Briefing laden
    const briefing = await prisma.briefing.findUnique({
      where: { id },
    });

    if (!briefing) {
      return NextResponse.json({ error: "Briefing nicht gefunden" }, { status: 404 });
    }

    // FormData mit Bild auslesen
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
    }

    // Prüfen ob es ein Bild ist
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Nur Bilder erlaubt (PNG, JPG, GIF, WebP)" }, { status: 400 });
    }

    // Dateigröße prüfen (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "Datei zu groß (max. 10MB)" }, { status: 400 });
    }

    // Altes Diagramm löschen falls vorhanden
    if (briefing.diagramUrl) {
      try {
        await del(briefing.diagramUrl);
      } catch (deleteError) {
        console.error("Error deleting old diagram:", deleteError);
      }
    }

    // Dateiendung ermitteln
    const extension = file.type.split("/")[1] || "png";
    const filename = `briefings/${briefing.id}/diagram-${Date.now()}.${extension}`;

    // Bild in Vercel Blob speichern
    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type,
    });

    // Briefing mit neuer diagramUrl aktualisieren
    const updatedBriefing = await prisma.briefing.update({
      where: { id },
      data: { diagramUrl: blob.url },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ 
      briefing: updatedBriefing,
      diagramUrl: blob.url,
    });
  } catch (error: any) {
    console.error("Error uploading diagram:", error);
    return NextResponse.json(
      { error: "Fehler beim Hochladen des Diagramms" },
      { status: 500 }
    );
  }
}

// DELETE - Diagramm löschen
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Nur Agentur-User können Diagramme löschen
    if (!isAgentur(user.role)) {
      return NextResponse.json({ error: "Nur für Agentur-Nutzer verfügbar" }, { status: 403 });
    }

    const { id } = await params;

    const briefing = await prisma.briefing.findUnique({
      where: { id },
    });

    if (!briefing) {
      return NextResponse.json({ error: "Briefing nicht gefunden" }, { status: 404 });
    }

    // Diagramm aus Blob löschen
    if (briefing.diagramUrl) {
      try {
        await del(briefing.diagramUrl);
      } catch (deleteError) {
        console.error("Error deleting diagram from blob:", deleteError);
      }
    }

    // diagramUrl im Briefing auf null setzen
    const updatedBriefing = await prisma.briefing.update({
      where: { id },
      data: { diagramUrl: null },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ briefing: updatedBriefing });
  } catch (error) {
    console.error("Error deleting diagram:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Diagramms" },
      { status: 500 }
    );
  }
}

interface BriefingData {
  title: string;
  briefingType: string;
  focusKeyword: string | null;
  bodyContent: string | null;
  h1: string | null;
  mainParagraph: string | null;
  topicCluster: string | null;
}

function buildImagePrompt(briefing: BriefingData): string {
  // Hauptthema extrahieren
  const topic = briefing.focusKeyword || briefing.h1 || briefing.title;
  const structure = briefing.bodyContent || "";
  
  // H2-Überschriften extrahieren (flexibel, bis zu 8)
  const h2Headings: string[] = [];
  const h2Matches = structure.matchAll(/##\s*H2:\s*([^\n]+)/gi);
  
  for (const match of h2Matches) {
    if (h2Headings.length < 8) {
      h2Headings.push(match[1].trim());
    }
  }

  // H3-Überschriften extrahieren (flexibel, bis zu 12)
  const h3Headings: string[] = [];
  const h3Matches = structure.matchAll(/###\s*H3:\s*([^\n]+)/gi);
  
  for (const match of h3Matches) {
    if (h3Headings.length < 12) {
      h3Headings.push(match[1].trim());
    }
  }

  // Prompt für Gemini 3 Pro Image - flexibel und detailliert
  let prompt = `Erstelle eine professionelle Infografik zum Thema "${topic}".

HAUPTTHEMA: "${topic}"
`;

  if (h2Headings.length > 0) {
    prompt += `
HAUPTABSCHNITTE (H2):
${h2Headings.map((h, i) => `${i + 1}. ${h}`).join("\n")}
`;
  }

  if (h3Headings.length > 0) {
    prompt += `
UNTERABSCHNITTE (H3):
${h3Headings.map((h, i) => `- ${h}`).join("\n")}
`;
  }

  // Kontext hinzufügen falls vorhanden
  if (briefing.mainParagraph) {
    prompt += `
KONTEXT: ${briefing.mainParagraph.substring(0, 300)}
`;
  }

  if (briefing.topicCluster) {
    prompt += `
VERWANDTE THEMEN: ${briefing.topicCluster.substring(0, 200)}
`;
  }

  prompt += `
DESIGN-ANFORDERUNGEN:
- Professionelle, moderne Infografik im Business-Stil
- Gut lesbare Schrift in allen Größen
- Klare visuelle Hierarchie (Hauptthema > H2s > H3s)
- Ansprechendes Farbschema mit Blautönen als Hauptfarbe
- Heller, sauberer Hintergrund
- Verbindungslinien oder Pfeile zwischen zusammenhängenden Elementen
- Gute Balance zwischen Inhalt und Weißraum
- Passende Icons oder einfache Illustrationen sind erlaubt
- Das Diagramm soll die Struktur des Artikels visuell darstellen

Der gesamte Text muss gut lesbar sein.`;

  return prompt;
}
