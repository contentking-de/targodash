import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiRateLimiter } from "@/lib/rate-limit";
import { GoogleGenAI } from "@google/genai";
import { proxyFetch, DEFAULT_SCRAPE_HEADERS } from "@/lib/proxy-fetch";

interface UrlContent {
  url: string;
  title: string;
  metaDescription: string;
  content: string;
  headings: { level: string; text: string }[];
  wordCount: number;
}

interface ContentGap {
  topic: string;
  description: string;
  priority: "high" | "medium" | "low";
  foundIn: string[];
}

interface Recommendation {
  category: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

interface AnalysisResult {
  ownContent: UrlContent;
  competitorContents: UrlContent[];
  contentGaps: ContentGap[];
  recommendations: Recommendation[];
  summary: {
    ownWordCount: number;
    avgCompetitorWordCount: number;
    ownHeadingsCount: number;
    avgCompetitorHeadingsCount: number;
    topicsInCompetitors: number;
    missingTopics: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success, remaining, resetIn } = aiRateLimiter.check(session.user.id);
    if (!success) {
      return NextResponse.json(
        { error: `Rate limit erreicht. Bitte warte ${resetIn} Sekunden.` },
        { status: 429, headers: { "Retry-After": String(resetIn), "X-RateLimit-Remaining": "0" } }
      );
    }

    const { keyword, ownUrl, competitorUrls } = await request.json();

    if (!keyword || !ownUrl || !competitorUrls || !Array.isArray(competitorUrls) || competitorUrls.length === 0) {
      return NextResponse.json(
        { error: "Keyword, eigene URL und mindestens eine Konkurrenz-URL sind erforderlich" },
        { status: 400 }
      );
    }

    console.log(`[Benchmarker Analyze] Starte Analyse für Keyword: "${keyword}"`);
    console.log(`[Benchmarker Analyze] Eigene URL: ${ownUrl}`);
    console.log(`[Benchmarker Analyze] Konkurrenten: ${competitorUrls.length}`);

    // Typen für Scrape-Ergebnisse
    type ScrapeSuccess = {
      url: string;
      success: true;
      title: string;
      metaDescription: string;
      content: string;
      headings: { level: string; text: string }[];
    };
    
    type ScrapeError = {
      url: string;
      success: false;
      error: string;
    };
    
    type ScrapeResult = ScrapeSuccess | ScrapeError;

    // Scrape alle URLs parallel
    const allUrls = [ownUrl, ...competitorUrls];
    const scrapedContents: ScrapeResult[] = await Promise.all(
      allUrls.map(async (url): Promise<ScrapeResult> => {
        try {
          const content = await scrapeUrl(url);
          return { url, ...content, success: true as const };
        } catch (error) {
          console.error(`[Benchmarker Analyze] Fehler beim Scrapen von ${url}:`, error);
          return { url, success: false as const, error: String(error) };
        }
      })
    );

    // Prüfe ob eigene URL erfolgreich gescraped wurde
    const ownContentResult = scrapedContents[0];
    if (!ownContentResult.success) {
      return NextResponse.json(
        { error: `Konnte eigene URL nicht laden: ${ownContentResult.error}` },
        { status: 400 }
      );
    }

    // Type Guard - jetzt weiß TypeScript dass ownContentResult ein ScrapeSuccess ist
    const ownScraped = ownContentResult as ScrapeSuccess;

    // Filtere erfolgreiche Konkurrenten-Scrapes
    const successfulCompetitors = scrapedContents.slice(1).filter(
      (c): c is ScrapeSuccess => c.success
    );
    
    if (successfulCompetitors.length === 0) {
      return NextResponse.json(
        { error: "Keine der Konkurrenz-URLs konnte geladen werden" },
        { status: 400 }
      );
    }

    console.log(`[Benchmarker Analyze] ${successfulCompetitors.length} von ${competitorUrls.length} URLs erfolgreich gescraped`);

    // Prepare content for AI analysis
    const ownContent: UrlContent = {
      url: ownUrl,
      title: ownScraped.title || "",
      metaDescription: ownScraped.metaDescription || "",
      content: ownScraped.content || "",
      headings: ownScraped.headings || [],
      wordCount: countWords(ownScraped.content || ""),
    };

    const competitorContents: UrlContent[] = successfulCompetitors.map(c => ({
      url: c.url,
      title: c.title || "",
      metaDescription: c.metaDescription || "",
      content: c.content || "",
      headings: c.headings || [],
      wordCount: countWords(c.content || ""),
    }));

    // AI-gestützte Analyse mit Gemini
    const aiAnalysis = await analyzeWithAI(keyword, ownContent, competitorContents);

    // Berechne Summary-Statistiken
    const avgCompetitorWordCount = Math.round(
      competitorContents.reduce((sum, c) => sum + c.wordCount, 0) / competitorContents.length
    );
    const avgCompetitorHeadingsCount = Math.round(
      competitorContents.reduce((sum, c) => sum + c.headings.length, 0) / competitorContents.length
    );

    const result: AnalysisResult = {
      ownContent,
      competitorContents,
      contentGaps: aiAnalysis.contentGaps,
      recommendations: aiAnalysis.recommendations,
      summary: {
        ownWordCount: ownContent.wordCount,
        avgCompetitorWordCount,
        ownHeadingsCount: ownContent.headings.length,
        avgCompetitorHeadingsCount,
        topicsInCompetitors: aiAnalysis.contentGaps.length + (aiAnalysis.recommendations.length > 0 ? aiAnalysis.recommendations.length : 0),
        missingTopics: aiAnalysis.contentGaps.filter(g => g.priority === "high" || g.priority === "medium").length,
      },
    };

    console.log(`[Benchmarker Analyze] ✓ Analyse abgeschlossen`);
    console.log(`[Benchmarker Analyze] Content Gaps: ${result.contentGaps.length}`);
    console.log(`[Benchmarker Analyze] Empfehlungen: ${result.recommendations.length}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Benchmarker Analyze] Fehler:", error);
    return NextResponse.json(
      { error: "Fehler bei der Content-Analyse" },
      { status: 500 }
    );
  }
}

async function scrapeUrl(url: string): Promise<{
  title: string;
  metaDescription: string;
  content: string;
  headings: { level: string; text: string }[];
}> {
  // Fetch through proxy to avoid geo-blocking
  const response = await proxyFetch(url, {
    headers: DEFAULT_SCRAPE_HEADERS,
    timeoutMs: 15000,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  return {
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    content: extractTextContent(html),
    headings: extractHeadings(html),
  };
}

function extractTextContent(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  const mainContentPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  let mainContent = text;
  for (const pattern of mainContentPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 200) {
      mainContent = match[1];
      break;
    }
  }

  mainContent = mainContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
  mainContent = mainContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  mainContent = mainContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  mainContent = mainContent.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");
  mainContent = mainContent.replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n");
  mainContent = mainContent.replace(/<(br|hr)[^>]*\/?>/gi, "\n");
  mainContent = mainContent.replace(/<[^>]+>/g, " ");
  mainContent = decodeHtmlEntities(mainContent);
  mainContent = mainContent.replace(/[ \t]+/g, " ");
  mainContent = mainContent.replace(/\n{3,}/g, "\n\n");
  mainContent = mainContent.trim();

  // Limitiere auf die ersten 10000 Zeichen für AI
  return mainContent.substring(0, 10000);
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1].trim());
  }
  return "";
}

function extractMetaDescription(html: string): string {
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i) ||
                    html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"[^>]*>/i);
  if (descMatch) {
    return decodeHtmlEntities(descMatch[1].trim());
  }
  return "";
}

function extractHeadings(html: string): { level: string; text: string }[] {
  const headings: { level: string; text: string }[] = [];
  let cleanHtml = html;
  cleanHtml = cleanHtml.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  cleanHtml = cleanHtml.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
  cleanHtml = cleanHtml.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = headingRegex.exec(cleanHtml)) !== null) {
    const level = `H${match[1]}`;
    let text = match[2];
    text = text.replace(/<[^>]+>/g, "");
    text = decodeHtmlEntities(text);
    text = text.replace(/\s+/g, " ").trim();
    if (text && text.length > 0 && text.length <= 200) {
      headings.push({ level, text });
    }
  }
  return headings;
}

function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&quot;": '"', "&apos;": "'", "&#39;": "'",
    "&ndash;": "–", "&mdash;": "—",
    "&auml;": "ä", "&ouml;": "ö", "&uuml;": "ü",
    "&Auml;": "Ä", "&Ouml;": "Ö", "&Uuml;": "Ü", "&szlig;": "ß",
  };
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  return decoded;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

async function analyzeWithAI(
  keyword: string,
  ownContent: UrlContent,
  competitorContents: UrlContent[]
): Promise<{
  contentGaps: ContentGap[];
  recommendations: Recommendation[];
}> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY nicht konfiguriert");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Bereite die Konkurrenz-Daten vor (gekürzt für AI)
    const competitorSummaries = competitorContents.map((c, i) => `
Konkurrent ${i + 1} (${c.url}):
- Titel: ${c.title}
- Wortanzahl: ${c.wordCount}
- Überschriften: ${c.headings.map(h => `${h.level}: ${h.text}`).join(", ")}
- Inhalt (Auszug): ${c.content.substring(0, 2000)}...
`).join("\n---\n");

    const prompt = `Du bist ein SEO-Experte. Analysiere den Content einer Website im Vergleich zu den Top-Konkurrenten für das Keyword "${keyword}".

EIGENE SEITE (${ownContent.url}):
- Titel: ${ownContent.title}
- Meta-Description: ${ownContent.metaDescription}
- Wortanzahl: ${ownContent.wordCount}
- Überschriften: ${ownContent.headings.map(h => `${h.level}: ${h.text}`).join(", ")}
- Inhalt (Auszug): ${ownContent.content.substring(0, 3000)}...

KONKURRENTEN:
${competitorSummaries}

Analysiere die Content-Gaps und erstelle Verbesserungsvorschläge. Antworte NUR mit validem JSON im folgenden Format:

{
  "contentGaps": [
    {
      "topic": "Thema das fehlt",
      "description": "Beschreibung was fehlt und warum es wichtig ist",
      "priority": "high|medium|low",
      "foundIn": ["URL1", "URL2"]
    }
  ],
  "recommendations": [
    {
      "category": "Content|Struktur|SEO|UX",
      "title": "Kurzer Titel der Empfehlung",
      "description": "Ausführliche Beschreibung was zu tun ist",
      "priority": "high|medium|low"
    }
  ]
}

Fokussiere auf:
1. Themen die bei Konkurrenten behandelt werden, aber auf der eigenen Seite fehlen
2. Strukturelle Unterschiede (Überschriften, Gliederung)
3. Inhaltliche Tiefe und Vollständigkeit
4. Fehlende Keywords oder Themenaspekte
5. Konkrete, umsetzbare Empfehlungen

Gib mindestens 3-5 Content Gaps und 3-5 Empfehlungen an. Schreibe auf Deutsch.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    // Extrahiere Text aus der Antwort
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extrahiere JSON aus der Antwort
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        contentGaps: parsed.contentGaps || [],
        recommendations: parsed.recommendations || [],
      };
    }

    console.warn("[Benchmarker Analyze] Konnte AI-Antwort nicht parsen");
    return { contentGaps: [], recommendations: [] };
  } catch (error) {
    console.error("[Benchmarker Analyze] AI-Analyse Fehler:", error);
    // Fallback ohne AI
    return {
      contentGaps: [],
      recommendations: [{
        category: "Allgemein",
        title: "AI-Analyse nicht verfügbar",
        description: "Die KI-gestützte Analyse konnte nicht durchgeführt werden. Bitte überprüfen Sie die Inhalte manuell.",
        priority: "medium" as const,
      }],
    };
  }
}
