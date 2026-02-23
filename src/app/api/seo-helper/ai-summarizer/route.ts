import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiRateLimiter } from "@/lib/rate-limit";
import OpenAI from "openai";
import { proxyFetch, DEFAULT_SCRAPE_HEADERS } from "@/lib/proxy-fetch";

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

    const { url, content, language = "de" } = await request.json();

    // Either URL or content must be provided
    if (!url && !content) {
      return NextResponse.json(
        { error: "URL oder Content ist erforderlich" },
        { status: 400 }
      );
    }

    // If URL is provided, fetch the content first
    let textContent = content;
    let pageTitle = "";
    let pageUrl = url;

    if (url && !content) {
      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
        pageUrl = parsedUrl.href;
      } catch {
        return NextResponse.json(
          { error: "Ungültige URL" },
          { status: 400 }
        );
      }

      // Fetch the URL content through proxy
      const response = await proxyFetch(url, {
        headers: DEFAULT_SCRAPE_HEADERS,
        timeoutMs: 15000,
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Fehler beim Laden: HTTP ${response.status}` },
          { status: 400 }
        );
      }

      const html = await response.text();
      textContent = extractTextContent(html);
      pageTitle = extractTitle(html);
    }

    // Check if content is too short
    if (!textContent || textContent.length < 100) {
      return NextResponse.json(
        { error: "Der Inhalt ist zu kurz für eine Zusammenfassung" },
        { status: 400 }
      );
    }

    // Truncate content if too long (keep ~12000 chars for API limits)
    const maxContentLength = 12000;
    if (textContent.length > maxContentLength) {
      textContent = textContent.substring(0, maxContentLength) + "...";
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API Key nicht konfiguriert" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const languageInstruction = language === "de" 
      ? "Antworte auf Deutsch." 
      : "Answer in English.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Du bist ein Experte für Content-Analyse und SEO. ${languageInstruction}

Deine Aufgabe ist es, den Inhalt einer Webseite zusammenzufassen und eine Content-Gap-Analyse durchzuführen.

WICHTIG für die FAQ-Analyse:
- Generiere zuerst die 5 häufigsten Fragen, die Nutzer ALLGEMEIN zu den Themen/Keywords stellen würden
- Diese Fragen basieren auf deinem allgemeinen Wissen über typische Suchanfragen, NICHT auf dem Inhalt der Seite
- Prüfe dann KRITISCH und OBJEKTIV, ob der vorliegende Content diese Fragen tatsächlich beantwortet
- Sei streng: Eine Frage gilt nur als beantwortet, wenn die Antwort explizit und ausreichend detailliert im Content vorkommt
- Wenn ein Thema nur oberflächlich angeschnitten wird, gilt die Frage als NICHT beantwortet

Erstelle eine strukturierte Zusammenfassung mit:
1. Einer kurzen Executive Summary (2-3 Sätze)
2. Den Hauptthemen/Kernaussagen als Bullet Points
3. Der Zielgruppe (falls erkennbar)
4. Dem Hauptzweck der Seite (informativ, kommerziell, etc.)
5. Möglichen SEO-relevanten Keywords
6. Den 5 häufigsten allgemeinen Fragen zu diesen Keywords (aus Nutzersicht)
7. Für jede Frage: Wird sie im Content beantwortet? (strenge Prüfung!)

Formatiere die Ausgabe als JSON mit folgendem Schema:
{
  "executiveSummary": "Kurze Zusammenfassung...",
  "mainTopics": ["Thema 1", "Thema 2", ...],
  "keyTakeaways": ["Kernaussage 1", "Kernaussage 2", ...],
  "targetAudience": "Beschreibung der Zielgruppe",
  "pageIntent": "informational|commercial|transactional|navigational",
  "suggestedKeywords": ["keyword1", "keyword2", ...],
  "contentType": "Artikel|Produktseite|Landingpage|Blog|etc.",
  "readingTime": "Geschätzte Lesezeit in Minuten",
  "frequentQuestions": [
    {
      "question": "Typische Nutzerfrage zu den Keywords (allgemein, nicht aus dem Content abgeleitet)",
      "isAnswered": true/false,
      "coverageNote": "Bei true: Wo genau wird es beantwortet. Bei false: Diese Info fehlt im Content komplett oder ist zu oberflächlich."
    }
  ]
}`
        },
        {
          role: "user",
          content: `Analysiere den folgenden Webseiteninhalt. 

WICHTIG: Generiere zuerst die 5 typischen Fragen, die Nutzer zu diesem Thema bei Google suchen würden (basierend auf allgemeinem SEO-Wissen). Prüfe dann streng, ob der Content diese Fragen wirklich beantwortet.

${pageTitle ? `Seitentitel: ${pageTitle}\n\n` : ""}Inhalt:
${textContent}`
        }
      ],
      temperature: 0.5,
      max_tokens: 2500,
    });

    const responseContent = completion.choices[0]?.message?.content || "{}";
    
    // Parse the JSON response
    let summary;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON object found");
      }
    } catch {
      return NextResponse.json(
        { error: "Fehler beim Verarbeiten der KI-Antwort" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summary,
      url: pageUrl,
      title: pageTitle,
      contentLength: textContent.length,
    });

  } catch (error) {
    console.error("Error in AI Summarizer:", error);
    return NextResponse.json(
      { error: "Fehler bei der Zusammenfassung. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}

function extractTextContent(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
  
  // Remove comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  
  // Try to extract main content area
  const mainContentPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  let mainContent = text;
  for (const pattern of mainContentPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].length > 200) {
      mainContent = match[1];
      break;
    }
  }

  // Remove header, footer, nav
  mainContent = mainContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
  mainContent = mainContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  mainContent = mainContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  mainContent = mainContent.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");

  // Convert block elements to newlines
  mainContent = mainContent.replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n");
  mainContent = mainContent.replace(/<(br|hr)[^>]*\/?>/gi, "\n");
  
  // Remove all remaining HTML tags
  mainContent = mainContent.replace(/<[^>]+>/g, " ");
  
  // Decode HTML entities
  mainContent = decodeHtmlEntities(mainContent);
  
  // Clean up whitespace
  mainContent = mainContent.replace(/[ \t]+/g, " ");
  mainContent = mainContent.replace(/\n[ \t]+/g, "\n");
  mainContent = mainContent.replace(/[ \t]+\n/g, "\n");
  mainContent = mainContent.replace(/\n{3,}/g, "\n\n");
  mainContent = mainContent.trim();

  return mainContent;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) {
    return decodeHtmlEntities(titleMatch[1].trim());
  }
  
  // Try og:title
  const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i) ||
                       html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"[^>]*>/i);
  if (ogTitleMatch) {
    return decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  return "";
}

function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&ndash;": "–",
    "&mdash;": "—",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&hellip;": "…",
    "&euro;": "€",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
    "&auml;": "ä",
    "&ouml;": "ö",
    "&uuml;": "ü",
    "&Auml;": "Ä",
    "&Ouml;": "Ö",
    "&Uuml;": "Ü",
    "&szlig;": "ß",
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  }

  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => 
    String.fromCharCode(parseInt(code, 10))
  );
  decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, code) => 
    String.fromCharCode(parseInt(code, 16))
  );

  return decoded;
}
