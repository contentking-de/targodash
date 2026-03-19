import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const JOURNEY_PHASES = [
  {
    id: "bewusstsein",
    name: "Bewusstsein",
    description: "Emotionaler Einstieg, erster Impuls – Miete vs. Kauf, lohnt sich Eigentum? Der Nutzer hat noch keine konkreten Pläne, wird aber neugierig.",
    keywords: "Miete vs. Kauf, lohnt sich Eigentum, Wohnung kaufen ja oder nein, Immobilie als Investition, Traum vom Eigenheim, erste Gedanken Hauskauf",
  },
  {
    id: "orientierung",
    name: "Orientierung",
    description: "Wissensaufbau, Grundbegriffe verstehen – Zinsen, Eigenkapital, Tilgung, KfW-Förderung. Der Nutzer informiert sich aktiv über Baufinanzierung und will die Basics verstehen.",
    keywords: "Zinsen Baufinanzierung, Eigenkapital, Tilgung, KfW-Förderung, Annuität, Sollzins Effektivzins, Grundbuch, Nebenkosten Hauskauf, Baufinanzierung Grundlagen",
  },
  {
    id: "planung",
    name: "Planung",
    description: "Konkrete Zahlen prüfen, Budget kalkulieren, Förderungen recherchieren. Der Nutzer rechnet durch, ob und wie viel Immobilie er sich leisten kann.",
    keywords: "Budget Hauskauf, Baufinanzierung Rechner, wie viel Haus kann ich mir leisten, Eigenkapital berechnen, monatliche Rate, Förderung Baufinanzierung, Tilgungsplan, Finanzierungsplan",
  },
  {
    id: "objektsuche",
    name: "Objektsuche",
    description: "Immobilie suchen, bewerten, besichtigen. Der Nutzer ist aktiv auf der Suche nach einem passenden Objekt und braucht Bewertungshilfen.",
    keywords: "Immobilie suchen, Haus bewerten, Besichtigung Checkliste, Immobilienbewertung, Grundstück kaufen, Neubau vs. Bestand, Makler, Exposé prüfen, Lage bewerten",
  },
  {
    id: "abschluss",
    name: "Abschluss",
    description: "Banken vergleichen, Kredit beantragen, Notar, Kaufvertrag. Der Nutzer steht kurz vor der Finanzierung und dem Kauf.",
    keywords: "Baufinanzierung vergleichen, Kredit beantragen, Notar Hauskauf, Kaufvertrag, Grundschuldbestellung, Bankgespräch, Finanzierungszusage, Darlehensvertrag, Zinsbindung wählen",
  },
];

const VALID_PHASES = JOURNEY_PHASES.map((p) => p.id);

const SYSTEM_PROMPT = `Du bist ein Experte für Content-Marketing und Customer Journeys im Bereich Baufinanzierung für Erstkäufer.

Deine Aufgabe: Ordne jeden Artikel/Content-Eintrag aus einem Redaktionsplan einer Phase der Customer Journey zu.

Die 5 Phasen der Customer Journey sind:

1. **bewusstsein** – Emotionaler Einstieg, erster Impuls (Miete vs. Kauf, lohnt sich Eigentum?)
   Keywords: ${JOURNEY_PHASES[0].keywords}

2. **orientierung** – Wissensaufbau, Grundbegriffe (Zinsen, Eigenkapital, Tilgung, KfW)
   Keywords: ${JOURNEY_PHASES[1].keywords}

3. **planung** – Konkrete Zahlen, Budget & Förderung prüfen
   Keywords: ${JOURNEY_PHASES[2].keywords}

4. **objektsuche** – Immobilie suchen, bewerten, besichtigen
   Keywords: ${JOURNEY_PHASES[3].keywords}

5. **abschluss** – Banken vergleichen, Kredit beantragen, Notar, Kauf
   Keywords: ${JOURNEY_PHASES[4].keywords}

Analysiere jeden Eintrag anhand von Titel, Beschreibung, Kategorie, URL und Funnel-Stufe.

WICHTIG: Antworte AUSSCHLIESSLICH mit einem validen JSON-Array. Kein Text davor oder danach. Jedes Element hat:
- "id": die ID des Eintrags (exakt wie übergeben)
- "phase": eine der 5 Phasen-IDs (bewusstsein, orientierung, planung, objektsuche, abschluss)
- "confidence": Konfidenz von 0.0 bis 1.0
- "reasoning": kurze Begründung (max. 10 Wörter, deutsch)`;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await prisma.editorialPlanEntry.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        url: true,
        category: true,
        ratgeberCategory: true,
        funnel: true,
        status: true,
        dueDate: true,
        journeyPhase: true,
        journeyConfidence: true,
        journeyReasoning: true,
        journeyMappedAt: true,
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({ entries, phases: JOURNEY_PHASES });
  } catch (error) {
    console.error("Error fetching customer journey data:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

interface ClassificationResult {
  id: string;
  phase: string;
  confidence: number;
  reasoning: string;
}

async function classifyBatch(
  batch: Array<{ id: string; title: string; description: string; category: string; ratgeberCategory: string; funnel: string; url: string }>,
  apiKey: string
): Promise<ClassificationResult[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Ordne diese ${batch.length} Einträge zu:\n${JSON.stringify(batch)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", errorText);
    throw new Error("KI-Klassifizierung fehlgeschlagen");
  }

  const data = await response.json();

  if (data.stop_reason === "max_tokens") {
    throw new Error("KI-Antwort wurde abgeschnitten. Bitte erneut versuchen.");
  }

  const textContent = data.content?.find((c: { type: string }) => c.type === "text")?.text;
  if (!textContent) {
    throw new Error("Keine Antwort von der KI erhalten");
  }

  let parsed: ClassificationResult[];
  try {
    parsed = JSON.parse(textContent.trim());
  } catch {
    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Could not parse Anthropic response:", textContent.slice(0, 500));
      throw new Error("KI-Antwort konnte nicht geparst werden");
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("KI-Antwort hat unerwartetes Format");
  }

  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const mode = body.mode as string | undefined;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    let entriesToClassify;

    if (mode === "unmapped") {
      entriesToClassify = await prisma.editorialPlanEntry.findMany({
        where: { journeyPhase: null },
        select: {
          id: true,
          title: true,
          description: true,
          url: true,
          category: true,
          ratgeberCategory: true,
          funnel: true,
        },
      });
    } else {
      entriesToClassify = await prisma.editorialPlanEntry.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          url: true,
          category: true,
          ratgeberCategory: true,
          funnel: true,
        },
      });
    }

    if (entriesToClassify.length === 0) {
      return NextResponse.json({ classifications: [], message: "Keine Einträge zum Klassifizieren" });
    }

    const entriesForPrompt = entriesToClassify.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description || "",
      category: e.category || "",
      ratgeberCategory: e.ratgeberCategory || "",
      funnel: e.funnel || "",
      url: e.url || "",
    }));

    const BATCH_SIZE = 15;
    const batches: typeof entriesForPrompt[] = [];
    for (let i = 0; i < entriesForPrompt.length; i += BATCH_SIZE) {
      batches.push(entriesForPrompt.slice(i, i + BATCH_SIZE));
    }

    const allClassifications: ClassificationResult[] = [];

    for (const batch of batches) {
      const results = await classifyBatch(batch, apiKey);
      allClassifications.push(...results);
    }

    const now = new Date();
    let savedCount = 0;

    for (const classification of allClassifications) {
      if (!VALID_PHASES.includes(classification.phase)) {
        console.warn(`Invalid phase "${classification.phase}" for entry ${classification.id}, skipping`);
        continue;
      }

      await prisma.editorialPlanEntry.update({
        where: { id: classification.id },
        data: {
          journeyPhase: classification.phase,
          journeyConfidence: classification.confidence,
          journeyReasoning: classification.reasoning,
          journeyMappedAt: now,
        },
      });
      savedCount++;
    }

    const updatedEntries = await prisma.editorialPlanEntry.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        url: true,
        category: true,
        ratgeberCategory: true,
        funnel: true,
        status: true,
        dueDate: true,
        journeyPhase: true,
        journeyConfidence: true,
        journeyReasoning: true,
        journeyMappedAt: true,
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({
      entries: updatedEntries,
      classified: savedCount,
      total: entriesToClassify.length,
    });
  } catch (error) {
    console.error("Error in customer journey classification:", error);
    const message = error instanceof Error ? error.message : "Klassifizierung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
