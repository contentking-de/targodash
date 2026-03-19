import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const JOURNEY_PHASES: Record<string, { name: string; description: string; keywords: string }> = {
  bewusstsein: {
    name: "Bewusstsein",
    description: "Emotionaler Einstieg, erster Impuls – Miete vs. Kauf, lohnt sich Eigentum?",
    keywords: "Miete vs. Kauf, lohnt sich Eigentum, Wohnung kaufen ja oder nein, Immobilie als Investition, Traum vom Eigenheim",
  },
  orientierung: {
    name: "Orientierung",
    description: "Wissensaufbau, Grundbegriffe verstehen – Zinsen, Eigenkapital, Tilgung, KfW-Förderung",
    keywords: "Zinsen Baufinanzierung, Eigenkapital, Tilgung, KfW-Förderung, Annuität, Sollzins Effektivzins, Grundbuch, Nebenkosten Hauskauf",
  },
  planung: {
    name: "Planung",
    description: "Konkrete Zahlen prüfen, Budget kalkulieren, Förderungen recherchieren",
    keywords: "Budget Hauskauf, Baufinanzierung Rechner, wie viel Haus kann ich mir leisten, Eigenkapital berechnen, monatliche Rate",
  },
  objektsuche: {
    name: "Objektsuche",
    description: "Immobilie suchen, bewerten, besichtigen",
    keywords: "Immobilie suchen, Haus bewerten, Besichtigung Checkliste, Immobilienbewertung, Grundstück kaufen, Neubau vs. Bestand",
  },
  abschluss: {
    name: "Abschluss",
    description: "Banken vergleichen, Kredit beantragen, Notar, Kaufvertrag",
    keywords: "Baufinanzierung vergleichen, Kredit beantragen, Notar Hauskauf, Kaufvertrag, Grundschuldbestellung, Finanzierungszusage",
  },
};

interface Suggestion {
  title: string;
  description: string;
  ratgeberCategory: string;
  funnel: string;
  reasoning: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "agentur") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { phaseId } = body;

    if (!phaseId || !JOURNEY_PHASES[phaseId]) {
      return NextResponse.json({ error: "Ungültige Phase" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const existingEntries = await prisma.editorialPlanEntry.findMany({
      where: { journeyPhase: phaseId },
      select: { title: true, description: true, ratgeberCategory: true, funnel: true },
    });

    const allEntries = await prisma.editorialPlanEntry.findMany({
      select: { title: true, journeyPhase: true },
    });

    const phase = JOURNEY_PHASES[phaseId];

    const systemPrompt = `Du bist ein erfahrener Content-Stratege für eine Direktbank (TARGOBANK) im Bereich Baufinanzierung. 
Du erstellst Themenvorschläge für Ratgeber-Artikel, die Erstkäufer von Immobilien ansprechen.

Kontext der Phase "${phase.name}": ${phase.description}
Relevante Keywords: ${phase.keywords}

Die vorhandenen Ratgeber-Kategorien sind:
- Erstfinanzierung
- Kapitalanlage
- Immobilie
- Anschlussfinanzierung
- Modernisierung
- Studien und Whitepaper
- Lexikon
- Checklisten für Käufer und Inhaber

Die Funnel-Stufen sind: Upper-Funnel, Mid-Funnel, Lower-Funnel

WICHTIG: Antworte AUSSCHLIESSLICH mit einem validen JSON-Array mit genau 5 Objekten. Kein Text davor oder danach.
Jedes Objekt hat:
- "title": Konkreter, SEO-tauglicher Artikel-Titel (deutsch)
- "description": Kurzbeschreibung des Artikels (2-3 Sätze, deutsch)
- "ratgeberCategory": Eine der obigen Kategorien, die am besten passt
- "funnel": Eine der drei Funnel-Stufen
- "reasoning": Warum dieser Artikel die Phase "${phase.name}" gut ergänzt (1 Satz)`;

    const existingTitles = allEntries.map((e) => e.title);
    const phaseArticles = existingEntries.map((e) => ({
      title: e.title,
      description: e.description || "",
      ratgeberCategory: e.ratgeberCategory || "",
      funnel: e.funnel || "",
    }));

    const userMessage = `Bereits abgedeckte Themen in dieser Phase (${phase.name}):
${phaseArticles.length > 0 ? JSON.stringify(phaseArticles, null, 2) : "Keine Artikel vorhanden."}

Alle bereits vorhandenen Artikel-Titel über alle Phasen:
${existingTitles.length > 0 ? existingTitles.map((t) => `- ${t}`).join("\n") : "Keine."}

Erstelle 5 neue, einzigartige Content-Vorschläge für die Phase "${phase.name}", die sich NICHT mit den bestehenden Themen überschneiden. Die Vorschläge sollen:
1. Thematisch zur Phase "${phase.name}" passen
2. Für Erstkäufer von Immobilien relevant sein
3. SEO-Potenzial haben
4. Die bestehende Content-Landschaft sinnvoll ergänzen`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      throw new Error("KI-Themenresearch fehlgeschlagen");
    }

    const data = await response.json();
    const textContent = data.content?.find((c: { type: string }) => c.type === "text")?.text;
    if (!textContent) {
      throw new Error("Keine Antwort von der KI erhalten");
    }

    let suggestions: Suggestion[];
    try {
      suggestions = JSON.parse(textContent.trim());
    } catch {
      const jsonMatch = textContent.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error("Could not parse response:", textContent.slice(0, 500));
        throw new Error("KI-Antwort konnte nicht geparst werden");
      }
      suggestions = JSON.parse(jsonMatch[0]);
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error("KI-Antwort hat unerwartetes Format");
    }

    return NextResponse.json({ suggestions, phaseId, phaseName: phase.name });
  } catch (error) {
    console.error("Error in theme research:", error);
    const message = error instanceof Error ? error.message : "Themenresearch fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
