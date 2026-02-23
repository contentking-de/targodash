import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAgentur } from "@/lib/rbac";
import OpenAI from "openai";

// Interface für extrahierte Seiteninhalte
interface PageContent {
  titleTag: string | null;
  metaDescription: string | null;
  h1: string | null;
  h2s: string[];
  h3s: string[];
  mainContent: string | null;
  internalLinks: string[];
  error?: string;
}

// Funktion zum Fetchen und Analysieren einer URL
async function fetchAndAnalyzeUrl(url: string): Promise<PageContent> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SEOBriefingBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000), // 10 Sekunden Timeout
    });

    if (!response.ok) {
      return {
        titleTag: null,
        metaDescription: null,
        h1: null,
        h2s: [],
        h3s: [],
        mainContent: null,
        internalLinks: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();

    // Title Tag extrahieren
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const titleTag = titleMatch ? titleMatch[1].trim() : null;

    // Meta Description extrahieren
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;

    // H1 extrahieren
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const h1 = h1Match ? h1Match[1].trim().replace(/\s+/g, " ") : null;

    // H2s extrahieren (bis zu 10)
    const h2Matches = html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi);
    const h2s: string[] = [];
    for (const match of h2Matches) {
      if (h2s.length >= 10) break;
      h2s.push(match[1].trim().replace(/\s+/g, " "));
    }

    // H3s extrahieren (bis zu 10)
    const h3Matches = html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/gi);
    const h3s: string[] = [];
    for (const match of h3Matches) {
      if (h3s.length >= 10) break;
      h3s.push(match[1].trim().replace(/\s+/g, " "));
    }

    // Hauptinhalt extrahieren (erster Absatz nach H1 oder im main/article)
    let mainContent: string | null = null;
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (mainMatch) {
      const paragraphMatch = mainMatch[1].match(/<p[^>]*>([^<]{50,500})/i);
      if (paragraphMatch) {
        mainContent = paragraphMatch[1].trim().replace(/\s+/g, " ");
      }
    }

    // Interne Links extrahieren
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const linkMatches = html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi);
    const internalLinks: string[] = [];
    for (const match of linkMatches) {
      const href = match[1];
      const text = match[2].trim();
      if (href.startsWith("/") || href.includes(domain)) {
        if (text.length > 2 && text.length < 100 && internalLinks.length < 15) {
          internalLinks.push(`${text} (${href})`);
        }
      }
    }

    return {
      titleTag,
      metaDescription,
      h1,
      h2s,
      h3s,
      mainContent,
      internalLinks,
    };
  } catch (error) {
    console.error("Error fetching URL:", error);
    return {
      titleTag: null,
      metaDescription: null,
      h1: null,
      h2s: [],
      h3s: [],
      mainContent: null,
      internalLinks: [],
      error: error instanceof Error ? error.message : "Unbekannter Fehler beim Laden der URL",
    };
  }
}

// Nur für Agentur-User (NICHT Superadmin)
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

    // NUR Agentur-User (nicht Superadmin!)
    if (!isAgentur(user.role)) {
      return NextResponse.json({ error: "Nur für Agentur-Nutzer verfügbar" }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API Key nicht konfiguriert" },
        { status: 500 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { field } = body;

    if (!field) {
      return NextResponse.json({ error: "Feld muss angegeben werden" }, { status: 400 });
    }

    // Briefing laden
    const briefing = await prisma.briefing.findUnique({
      where: { id },
    });

    if (!briefing) {
      return NextResponse.json({ error: "Briefing nicht gefunden" }, { status: 404 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Bei edit_content: URL analysieren
    let pageContent: PageContent | null = null;
    if (briefing.briefingType === "edit_content" && briefing.url) {
      pageContent = await fetchAndAnalyzeUrl(briefing.url);
    }

    // Kontext aus Briefing-Bestelldaten zusammenbauen
    const context = buildContext(briefing, pageContent);
    const prompt = buildPrompt(field, context, briefing, pageContent);
    const systemPrompt = getSystemPrompt(briefing.briefingType);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const suggestion = completion.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Error generating AI suggestion:", error);
    return NextResponse.json(
      { error: "Fehler bei der KI-Generierung" },
      { status: 500 }
    );
  }
}

interface BriefingData {
  title: string;
  briefingType: string;
  contentAction: string;
  targetAudience: string | null;
  funnelStage: string | null;
  goals: string | null;
  focusKeyword: string | null;
  keywordCluster: string | null;
  topicCluster: string | null;
  searchIntent: string | null;
  url: string | null;
  benchmarkUrls: string | null;
  // Lexikon-spezifische Felder
  lexiconDefinition: string | null;
  lexiconSynonyms: string | null;
  lexiconRelated: string | null;
}

function getSystemPrompt(briefingType: string): string {
  const baseRules = `
Wichtige Regeln:
- Antworte NUR mit dem gewünschten Inhalt, keine Erklärungen oder Einleitungen
- Verwende das Fokus-Keyword natürlich im Text
- Halte dich an SEO Best Practices
- Schreibe auf Deutsch (Hochdeutsch)`;

  switch (briefingType) {
    case "new_content":
      return `Du bist ein erfahrener SEO-Content-Spezialist für die Erstellung von neuem Content. Du erstellst präzise, suchmaschinenoptimierte Inhalte für neue Webseiten.
${baseRules}
- Erstelle umfassende, informative Inhalte
- Berücksichtige die Zielgruppe und den Search Intent
- Sei konkret und handlungsorientiert
- Strukturiere Inhalte klar und übersichtlich`;

    case "edit_content":
      return `Du bist ein erfahrener SEO-Content-Spezialist für Content-Optimierung. Du analysierst bestehende Seiten und gibst konkrete Verbesserungsvorschläge.

WICHTIGE REGELN:
- Du erhältst den aktuellen IST-Zustand der Seite aus einer URL-Analyse
- Vergleiche IST mit dem optimalen SOLL-Zustand
- Gib deine Antwort IMMER im Format "IST: ... | SOLL: ..." 
- Wenn der aktuelle Inhalt bereits gut optimiert ist, antworte mit: "✓ Bereits gut optimiert, keine Änderung notwendig"
- Mache NUR Änderungsvorschläge, wenn sie echten Mehrwert bringen
- Halte den Stil und Tone-of-Voice der bestehenden Seite bei
- Begründe kurz, WARUM eine Änderung sinnvoll ist (in Klammern)
${baseRules}
- Sei kritisch und ehrlich - nicht jedes Element muss geändert werden
- Priorisiere Änderungen nach SEO-Impact`;

    case "lexicon":
      return `Du bist ein erfahrener SEO-Content-Spezialist für Lexikon- und Glossar-Einträge. Du erstellst präzise, verständliche Begriffserklärungen.
${baseRules}
- Schreibe klar, prägnant und leicht verständlich
- Erkläre Fachbegriffe für Laien verständlich
- Verwende eine sachliche, informative Tonalität
- Strukturiere Definitionen logisch (Was ist es? Wofür wird es verwendet? Beispiele)
- Integriere verwandte Begriffe und Synonyme natürlich
- Halte dich kurz und auf den Punkt - Lexikon-Einträge sind keine ausführlichen Ratgeber`;

    default:
      return `Du bist ein erfahrener SEO-Content-Spezialist. Du erstellst präzise, suchmaschinenoptimierte Inhalte basierend auf Briefing-Daten.
${baseRules}
- Berücksichtige die Zielgruppe und den Search Intent
- Sei konkret und handlungsorientiert`;
  }
}

function buildContext(briefing: BriefingData, pageContent: PageContent | null = null): string {
  const parts: string[] = [];
  
  parts.push(`Briefing-Typ: ${getBriefingTypeLabel(briefing.briefingType)}`);
  parts.push(`Briefing-Titel: ${briefing.title}`);
  
  if (briefing.briefingType !== "lexicon") {
    parts.push(`Ausgangslage: ${getContentActionLabel(briefing.contentAction)}`);
  }
  
  if (briefing.focusKeyword) {
    parts.push(`Fokus-Keyword: ${briefing.focusKeyword}`);
  }
  
  // Lexikon-spezifische Informationen
  if (briefing.briefingType === "lexicon") {
    if (briefing.lexiconDefinition) {
      parts.push(`Definition (vom Besteller): ${briefing.lexiconDefinition}`);
    }
    if (briefing.lexiconSynonyms) {
      parts.push(`Synonyme: ${briefing.lexiconSynonyms}`);
    }
    if (briefing.lexiconRelated) {
      parts.push(`Verwandte Begriffe: ${briefing.lexiconRelated}`);
    }
  }
  
  if (briefing.targetAudience) {
    parts.push(`Zielgruppe: ${briefing.targetAudience}`);
  }
  
  if (briefing.funnelStage) {
    parts.push(`Funnel-Stufe: ${getFunnelStageLabel(briefing.funnelStage)}`);
  }
  
  if (briefing.searchIntent) {
    parts.push(`Search Intent: ${getSearchIntentLabel(briefing.searchIntent)}`);
  }
  
  if (briefing.goals) {
    parts.push(`Ziele/KPIs: ${briefing.goals}`);
  }
  
  if (briefing.keywordCluster) {
    parts.push(`Keyword-Cluster: ${briefing.keywordCluster}`);
  }
  
  if (briefing.topicCluster) {
    parts.push(`Topic-Cluster: ${briefing.topicCluster}`);
  }
  
  if (briefing.url) {
    parts.push(`Ziel-URL: ${briefing.url}`);
  }

  // Bei edit_content: Aktuellen Seiteninhalt hinzufügen
  if (briefing.briefingType === "edit_content" && pageContent) {
    parts.push("\n--- AKTUELLER SEITENINHALT (IST-ZUSTAND) ---");
    
    if (pageContent.error) {
      parts.push(`⚠️ Fehler beim Laden der Seite: ${pageContent.error}`);
    } else {
      if (pageContent.titleTag) {
        parts.push(`Aktueller Title Tag: "${pageContent.titleTag}"`);
      }
      if (pageContent.metaDescription) {
        parts.push(`Aktuelle Meta Description: "${pageContent.metaDescription}"`);
      }
      if (pageContent.h1) {
        parts.push(`Aktuelle H1: "${pageContent.h1}"`);
      }
      if (pageContent.h2s.length > 0) {
        parts.push(`Aktuelle H2-Überschriften:\n${pageContent.h2s.map(h => `  - ${h}`).join("\n")}`);
      }
      if (pageContent.h3s.length > 0) {
        parts.push(`Aktuelle H3-Überschriften:\n${pageContent.h3s.map(h => `  - ${h}`).join("\n")}`);
      }
      if (pageContent.mainContent) {
        parts.push(`Auszug aus Hauptinhalt: "${pageContent.mainContent}..."`);
      }
      if (pageContent.internalLinks.length > 0) {
        parts.push(`Gefundene interne Links:\n${pageContent.internalLinks.slice(0, 10).map(l => `  - ${l}`).join("\n")}`);
      }
    }
    parts.push("--- ENDE SEITENINHALT ---\n");
  }
  
  return parts.join("\n");
}

function getBriefingTypeLabel(type: string): string {
  switch (type) {
    case "new_content": return "Neuer Content";
    case "edit_content": return "Content überarbeiten";
    case "lexicon": return "Lexikon Content";
    default: return type;
  }
}

function buildPrompt(field: string, context: string, briefing: BriefingData, pageContent: PageContent | null = null): string {
  const basePrompt = `Basierend auf folgenden Briefing-Daten:\n\n${context}\n\n`;
  const isLexicon = briefing.briefingType === "lexicon";
  const isEdit = briefing.briefingType === "edit_content";
  
  // IST/SOLL Anweisungen für edit_content
  const editFormatInstructions = `
ANTWORT-FORMAT:
Falls Änderung sinnvoll:
IST: [Aktueller Inhalt aus der Seitenanalyse]
SOLL: [Dein optimierter Vorschlag]
(Begründung: [Kurze Erklärung warum diese Änderung SEO-Mehrwert bringt])

Falls keine Änderung nötig:
✓ Bereits gut optimiert, keine Änderung notwendig
(Begründung: [Warum der aktuelle Stand bereits gut ist])
`;
  
  switch (field) {
    case "titleTag":
      if (isLexicon) {
        return basePrompt + `Erstelle einen SEO-optimierten Title Tag für einen Lexikon-Eintrag (max. 60 Zeichen).
- Format: "[Begriff]: Definition & Erklärung | [Brand]" oder ähnlich
- Enthalte den Begriff am Anfang
- Mache klar, dass es eine Begriffserklärung ist
- Keine Anführungszeichen`;
      }
      if (isEdit) {
        return basePrompt + `Analysiere den aktuellen Title Tag und bewerte, ob eine Optimierung sinnvoll ist.

Prüfkriterien:
- Enthält das Fokus-Keyword (idealerweise am Anfang)?
- Ist die Länge optimal (50-60 Zeichen)?
- Ist der Title klickstark und relevant?
- Entspricht er dem Search Intent?
${editFormatInstructions}`;
      }
      return basePrompt + `Erstelle einen SEO-optimierten Title Tag (max. 60 Zeichen).
- Enthalte das Fokus-Keyword möglichst am Anfang
- Mache ihn klickstark und relevant
- Keine Anführungszeichen`;

    case "metaDescription":
      if (isLexicon) {
        return basePrompt + `Erstelle eine SEO-optimierte Meta Description für einen Lexikon-Eintrag (max. 155 Zeichen).
- Beginne mit einer kurzen Definition
- Mache neugierig auf weitere Details
- Verwende Formulierungen wie "Erfahren Sie..." oder "Definition und Erklärung von..."`;
      }
      if (isEdit) {
        return basePrompt + `Analysiere die aktuelle Meta Description und bewerte, ob eine Optimierung sinnvoll ist.

Prüfkriterien:
- Enthält das Fokus-Keyword natürlich?
- Ist die Länge optimal (140-155 Zeichen)?
- Hat sie einen klaren Call-to-Action?
- Macht sie neugierig und ist klickstark?
${editFormatInstructions}`;
      }
      return basePrompt + `Erstelle eine SEO-optimierte Meta Description (max. 155 Zeichen).
- Enthalte das Fokus-Keyword natürlich
- Füge einen Call-to-Action ein
- Mache sie klickstark und informativ`;

    case "h1":
      if (isLexicon) {
        return basePrompt + `Erstelle eine H1-Überschrift für einen Lexikon-Eintrag.
- Einfach der Begriff oder "Was ist [Begriff]?"
- Klar und direkt
- Max. 50 Zeichen`;
      }
      if (isEdit) {
        return basePrompt + `Analysiere die aktuelle H1-Überschrift und bewerte, ob eine Optimierung sinnvoll ist.

Prüfkriterien:
- Enthält das Fokus-Keyword?
- Beschreibt sie klar den Seiteninhalt?
- Ist sie einzigartig und ansprechend?
- Ist die Länge angemessen (max. 70 Zeichen)?
${editFormatInstructions}`;
      }
      return basePrompt + `Erstelle eine H1-Überschrift.
- Enthalte das Fokus-Keyword
- Sie sollte klar den Seiteninhalt beschreiben
- Max. 70 Zeichen`;

    case "navTitle":
      if (isLexicon) {
        return basePrompt + `Erstelle einen kurzen Navigationstitel für den Lexikon-Eintrag (max. 25 Zeichen).
- Nur der Begriff selbst
- Prägnant und verständlich`;
      }
      if (isEdit) {
        return basePrompt + `Schlage einen optimierten Navigationstitel vor (max. 30 Zeichen).
- Prägnant und verständlich
- Passend für die Seitennavigation
- Enthält das Kernthema
${editFormatInstructions}`;
      }
      return basePrompt + `Erstelle einen kurzen Navigationstitel (max. 30 Zeichen).
- Prägnant und verständlich
- Passend für die Seitennavigation`;

    case "mainParagraph":
      if (isLexicon) {
        return basePrompt + `Erstelle einen Einleitungsparagrafen für den Lexikon-Eintrag (2-3 Sätze):
- Beginne mit einer klaren Definition des Begriffs
- Erkläre kurz, warum der Begriff relevant ist
- Verständlich für Laien
- Sachlich und informativ`;
      }
      if (isEdit) {
        return basePrompt + `Analysiere den aktuellen Hauptparagrafen/Einleitungstext und bewerte, ob eine Optimierung sinnvoll ist.

Prüfkriterien:
- Wird das Fokus-Keyword im ersten Satz verwendet?
- Kommuniziert er klar den Mehrwert für die Zielgruppe?
- Animiert er zum Weiterlesen?
- Ist er auf den Search Intent ausgerichtet?
${editFormatInstructions}`;
      }
      return basePrompt + `Erstelle einen Hauptparagrafen (2-3 Sätze), der:
- Das Fokus-Keyword im ersten Satz enthält
- Den Mehrwert für die Zielgruppe klar kommuniziert
- Zum Weiterlesen animiert`;

    case "primaryCta":
      if (isLexicon) {
        return basePrompt + `Erstelle einen Call-to-Action für den Lexikon-Eintrag.
- Leitet zu vertiefenden Inhalten oder Beratung
- Beispiele: "Mehr erfahren", "Jetzt beraten lassen", "Produkte entdecken"
- 2-4 Wörter`;
      }
      if (isEdit) {
        return basePrompt + `Schlage einen optimierten Primary Call-to-Action vor.

Prüfkriterien:
- Ist er handlungsorientiert und klar?
- Passt er zur Funnel-Stufe und den Zielen?
- Ist er spezifisch genug für die Zielgruppe?
${editFormatInstructions}`;
      }
      return basePrompt + `Erstelle einen Primary Call-to-Action.
- Kurz und handlungsorientiert (2-5 Wörter)
- Passend zur Funnel-Stufe und den Zielen
- Beispiele: "Jetzt anfragen", "Mehr erfahren", "Beratung vereinbaren"`;

    case "secondaryCta":
      if (isLexicon) {
        return basePrompt + `Erstelle einen Secondary CTA für verwandte Lexikon-Einträge.
- Leitet zu verwandten Begriffen
- Beispiele: "Verwandte Begriffe", "Mehr im Glossar"
- 2-4 Wörter`;
      }
      if (isEdit) {
        return basePrompt + `Schlage einen optimierten Secondary Call-to-Action vor.
- Weniger dringlich als Primary CTA
- Führt zu verwandten/ergänzenden Inhalten
- 2-5 Wörter
${editFormatInstructions}`;
      }
      return basePrompt + `Erstelle einen Secondary Call-to-Action für eine weiterführende Seite.
- Weniger dringlich als Primary CTA
- Führt zu verwandten Inhalten
- 2-5 Wörter`;

    case "inboundCta":
      if (isLexicon) {
        return basePrompt + `Erstelle einen Inbound CTA-Text, mit dem von anderen Seiten auf diesen Lexikon-Eintrag verlinkt werden kann.
- Als Linktext geeignet
- Beispiele: "Was ist [Begriff]?", "[Begriff] im Glossar", "Definition von [Begriff]"
- 3-5 Wörter`;
      }
      if (isEdit) {
        return basePrompt + `Schlage einen optimierten Inbound CTA-Text vor, mit dem von anderen Seiten auf diese Seite verlinkt werden kann.
- Als Ankertext/Linktext geeignet
- Enthält das Fokus-Keyword natürlich
- 3-6 Wörter
${editFormatInstructions}`;
      }
      return basePrompt + `Erstelle einen Inbound CTA-Text, mit dem von anderen Seiten auf diese Seite verlinkt werden kann.
- Als Linktext geeignet
- Enthält das Fokus-Keyword
- 3-6 Wörter`;

    case "keywordsetLongtail":
      return basePrompt + `Liste 8-12 relevante Longtail-Keywords auf.

WICHTIG: NUR die Keywords auflisten, KEINE Beschreibungen, KEINE Erklärungen.

Format (eines pro Zeile, nur das Keyword):
keyword phrase eins
keyword phrase zwei
keyword phrase drei
...`;

    case "topicclusterContent":
      return basePrompt + `Liste 6-10 verwandte Themen/Begriffe für den Topiccluster auf.

WICHTIG: NUR die Themen/Begriffe auflisten, KEINE Beschreibungen, KEINE Erklärungen.

Format (eines pro Zeile, nur das Thema):
Thema eins
Thema zwei
Thema drei
...`;

    case "bodyContent":
      if (isLexicon) {
        return basePrompt + `Erstelle eine Strukturvorlage für einen Lexikon-Eintrag mit H2-H3 Überschriften.

WICHTIG: Die Briefings sind Anweisungen für Autoren, die den Content schreiben sollen. Die Beschreibungen unter jeder Überschrift müssen daher als klare Arbeitsanweisungen formuliert sein - ohne direkte Anrede (kein "Sie" oder "Du").

Format:
## H2: [Überschrift]
Ausführlich beschreiben und ausformulieren: [Kerninhalt/Thema das behandelt werden soll]

### H3: [Überschrift]
Ausführlich beschreiben und ausformulieren: [Kerninhalt/Thema das behandelt werden soll]

Typische Struktur für Lexikon-Einträge:
- Definition (bereits als Hauptparagraf)
- Erklärung / Wie funktioniert es?
- Arten / Varianten (falls zutreffend)
- Vorteile / Nachteile (falls zutreffend)
- Beispiele
- Verwandte Begriffe

Erstelle 3-4 passende Abschnitte für diesen spezifischen Begriff. Jede Beschreibung muss mit "Ausführlich beschreiben und ausformulieren:" beginnen.`;
      }
      if (isEdit) {
        return basePrompt + `Analysiere die aktuelle Seitenstruktur (H2/H3-Überschriften) und bewerte, ob Optimierungen sinnvoll sind.

WICHTIG: Die Briefings sind Anweisungen für Autoren, die den Content schreiben sollen. Bei neuen oder geänderten Abschnitten müssen die Beschreibungen als klare Arbeitsanweisungen formuliert sein - ohne direkte Anrede (kein "Sie" oder "Du").

Prüfkriterien:
- Ist die Hierarchie logisch und SEO-konform?
- Werden wichtige Themen aus dem Keyword-/Topic-Cluster abgedeckt?
- Gibt es Content-Gaps im Vergleich zu Wettbewerbern?
- Ist die Struktur für den User verständlich?

ANTWORT-FORMAT für Strukturvorschläge:

IST-STRUKTUR:
[Liste der aktuellen H2/H3 Überschriften]

SOLL-STRUKTUR (nur falls Änderungen sinnvoll):
## H2: [Überschrift] ← [NEU/BEHALTEN/ÄNDERN]
Ausführlich beschreiben und ausformulieren: [Kerninhalt/Thema das behandelt werden soll]

### H3: [Überschrift] ← [NEU/BEHALTEN/ÄNDERN]
Ausführlich beschreiben und ausformulieren: [Kerninhalt/Thema das behandelt werden soll]

(Begründung: [Erklärung der vorgeschlagenen Änderungen])

Falls keine Änderung nötig:
✓ Struktur bereits gut aufgebaut, keine wesentlichen Änderungen notwendig`;
      }
      return basePrompt + `Erstelle eine Strukturvorlage für den Fliesstext mit H2-H4 Überschriften.

WICHTIG: Die Briefings sind Anweisungen für Autoren, die den Content schreiben sollen. Die Beschreibungen unter jeder Überschrift müssen daher als klare Arbeitsanweisungen formuliert sein - ohne direkte Anrede (kein "Sie" oder "Du").

Format:
## H2: [Überschrift]
Ausführlich beschreiben und ausformulieren: [Kerninhalt/Thema das behandelt werden soll]

### H3: [Überschrift]
Ausführlich beschreiben und ausformulieren: [Kerninhalt/Thema das behandelt werden soll]

- Erstelle 3-5 sinnvolle Abschnitte
- Berücksichtige das Keyword-Cluster und Topic-Cluster
- Jeder Abschnitt sollte einen klaren Mehrwert bieten
- Jede Beschreibung muss mit "Ausführlich beschreiben und ausformulieren:" beginnen`;

    case "internalLinks":
      if (isLexicon) {
        return basePrompt + `Schlage 3-5 interne Verlinkungen für den Lexikon-Eintrag vor.
Format: [Ankertext] -> [Beschreibung der Zielseite]

Fokus auf:
- Andere Lexikon-/Glossar-Einträge zu verwandten Begriffen
- Ratgeber oder Produktseiten zum Thema
- Übergeordnete Themen-Übersichtsseiten`;
      }
      if (isEdit) {
        return basePrompt + `Analysiere die aktuellen internen Verlinkungen und schlage Optimierungen vor.

Prüfkriterien:
- Sind relevante Topic-Cluster-Seiten verlinkt?
- Unterstützen die Links die Customer Journey?
- Gibt es fehlende wichtige interne Verlinkungen?

ANTWORT-FORMAT:
AKTUELLE LINKS (aus Analyse):
[Liste der gefundenen internen Links]

EMPFEHLUNGEN:
✓ Behalten: [Link] - (Begründung)
✗ Entfernen/Ersetzen: [Link] - (Begründung)
+ Hinzufügen: [Ankertext] -> [Zielseite] - (Begründung)

Falls keine Änderung nötig:
✓ Interne Verlinkung bereits gut aufgebaut`;
      }
      return basePrompt + `Schlage 3-5 interne Verlinkungen vor.
Format: [Ankertext] -> [Beschreibung der Zielseite]

Berücksichtige:
- Das Topic-Cluster
- Verwandte Themen
- Customer Journey`;

    case "missingTopics":
      if (isLexicon) {
        return basePrompt + `Analysiere das Briefing und identifiziere 3-5 Aspekte, die in einem vollständigen Lexikon-Eintrag behandelt werden sollten.
- Häufige Fragen zum Begriff
- Verwandte Konzepte die erklärt werden sollten
- Praxisbeispiele
- Format: Bullet Points`;
      }
      if (isEdit) {
        return basePrompt + `Analysiere die aktuelle Seite und identifiziere Content-Gaps.

Vergleiche den aktuellen Inhalt mit:
- Dem Fokus-Keyword und Keyword-Cluster
- Dem Search Intent der Zielgruppe
- Typischen Fragen zum Thema
- Best Practices im Themenbereich

ANTWORT-FORMAT:
CONTENT-GAPS (priorisiert nach SEO-Impact):

🔴 Hohe Priorität:
- [Fehlendes Thema] - (Begründung warum wichtig)

🟡 Mittlere Priorität:
- [Fehlendes Thema] - (Begründung)

🟢 Nice-to-have:
- [Fehlendes Thema] - (Begründung)

Falls keine relevanten Gaps:
✓ Content deckt die wichtigsten Themen bereits gut ab`;
      }
      return basePrompt + `Analysiere das Briefing und identifiziere 3-5 Themen, die möglicherweise noch fehlen.
- Basierend auf dem Search Intent
- Basierend auf dem Keyword-/Topic-Cluster
- Häufige Nutzerfragen zum Thema
- Format: Bullet Points`;

    case "faqs":
      if (isLexicon) {
        return basePrompt + `Erstelle 4-6 häufig gestellte Fragen (FAQs) zum Begriff.

Format (exakt einhalten):
Q: [Frage]?
A: [Antwort in 1-2 Sätzen]

Q: [Frage]?
A: [Antwort in 1-2 Sätzen]

Typische Fragen für Lexikon-Einträge:
- Was bedeutet [Begriff]?
- Wie funktioniert [Begriff]?
- Was ist der Unterschied zwischen [Begriff] und [verwandter Begriff]?
- Wann braucht man [Begriff]?
- Welche Arten von [Begriff] gibt es?

Antworten sollten:
- Kurz und präzise sein
- Für Laien verständlich
- Für Featured Snippets optimiert`;
      }
      if (isEdit) {
        return basePrompt + `Erstelle oder optimiere FAQs für die Seite basierend auf dem Fokus-Keyword und Search Intent.

Prüfe:
- Welche Fragen haben Nutzer typischerweise zu diesem Thema?
- Welche Long-Tail-Keywords können als Fragen formuliert werden?
- Welche Fragen könnten für Featured Snippets ranken?

Format (exakt einhalten):
Q: [Frage]?
A: [Antwort in 1-2 Sätzen]

Erstelle 5-7 relevante FAQs, die:
- Echte Nutzerfragen abbilden
- Das Fokus-Keyword und verwandte Keywords natürlich einbinden
- Prägnant und hilfreich sind
- Für Featured Snippets optimiert sind`;
      }
      return basePrompt + `Erstelle 5-7 häufig gestellte Fragen (FAQs) mit Antworten zum Thema.

Format (exakt einhalten):
Q: [Frage]?
A: [Antwort in 1-2 Sätzen]

Q: [Frage]?
A: [Antwort in 1-2 Sätzen]

Regeln:
- Fragen sollten echte Nutzerfragen abbilden
- Basierend auf dem Fokus-Keyword und Search Intent
- Antworten sollten prägnant und hilfreich sein
- Berücksichtige auch Long-Tail-Keywords aus dem Keyword-Cluster
- Die FAQs sollten für Featured Snippets optimiert sein`;

    default:
      return basePrompt + `Erstelle einen passenden Vorschlag für das Feld "${field}".`;
  }
}

function getContentActionLabel(action: string): string {
  switch (action) {
    case "edit": return "Content überarbeiten";
    case "merge": return "Content mergen";
    case "new": return "Content neu erstellen";
    default: return action;
  }
}

function getFunnelStageLabel(stage: string): string {
  switch (stage) {
    case "attention": return "Attention (Aufmerksamkeit)";
    case "interest": return "Interest (Interesse)";
    case "desire": return "Desire (Verlangen)";
    case "action": return "Action (Handlung)";
    default: return stage;
  }
}

function getSearchIntentLabel(intent: string): string {
  switch (intent) {
    case "informational": return "Informational (sucht nach Informationen)";
    case "navigational": return "Navigational (sucht spezifische Website)";
    case "transactional": return "Transactional (will kaufen)";
    case "commercial": return "Commercial (will vergleichen)";
    default: return intent;
  }
}
