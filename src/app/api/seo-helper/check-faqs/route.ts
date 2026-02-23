import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiRateLimiter } from "@/lib/rate-limit";
import OpenAI from "openai";

interface FAQ {
  question: string;
  searchIntent: string;
  questionType: string;
}

interface FAQCheckResult {
  question: string;
  status: "found" | "partial" | "missing";
  matchType: "exact" | "similar" | "semantic" | "none";
  evidence?: string;
  confidence: number;
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

    const { url, faqs } = await request.json();

    if (!url || !faqs || !Array.isArray(faqs)) {
      return NextResponse.json(
        { error: "URL und FAQs sind erforderlich" },
        { status: 400 }
      );
    }

    // Fetch the URL content (forward cookies for auth)
    const contentResponse = await fetch(`${request.nextUrl.origin}/api/seo-helper/fetch-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ url }),
    });

    if (!contentResponse.ok) {
      const error = await contentResponse.json();
      return NextResponse.json(
        { error: error.error || "Fehler beim Laden der URL" },
        { status: 400 }
      );
    }

    const { content, headings } = await contentResponse.json();

    if (!content || content.length < 50) {
      return NextResponse.json(
        { error: "Nicht genug Content auf der Seite gefunden" },
        { status: 400 }
      );
    }

    // Combine content with headings for better matching
    const headingTexts = headings?.map((h: { text: string }) => h.text).join(" ") || "";
    const fullContent = `${headingTexts} ${content}`.toLowerCase();

    // Check each FAQ
    const results: FAQCheckResult[] = [];

    for (const faq of faqs) {
      const question = faq.question;
      const result = await checkQuestionInContent(question, fullContent, content);
      results.push(result);
    }

    // If OpenAI is available, do semantic analysis for "missing" or "partial" items
    if (process.env.OPENAI_API_KEY) {
      const needsSemanticCheck = results.filter(
        r => r.status === "missing" || (r.status === "partial" && r.confidence < 70)
      );

      if (needsSemanticCheck.length > 0) {
        const semanticResults = await performSemanticCheck(
          needsSemanticCheck.map(r => r.question),
          content
        );

        // Merge semantic results
        for (const semanticResult of semanticResults) {
          const index = results.findIndex(r => r.question === semanticResult.question);
          if (index !== -1 && semanticResult.confidence > results[index].confidence) {
            results[index] = semanticResult;
          }
        }
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      found: results.filter(r => r.status === "found").length,
      partial: results.filter(r => r.status === "partial").length,
      missing: results.filter(r => r.status === "missing").length,
      coverage: Math.round(
        ((results.filter(r => r.status === "found").length * 100) +
         (results.filter(r => r.status === "partial").length * 50)) / results.length
      ),
    };

    return NextResponse.json({ results, summary });

  } catch (error) {
    console.error("Error checking FAQs:", error);
    return NextResponse.json(
      { error: "Fehler bei der Prüfung" },
      { status: 500 }
    );
  }
}

async function checkQuestionInContent(
  question: string,
  fullContentLower: string,
  originalContent: string
): Promise<FAQCheckResult> {
  const questionLower = question.toLowerCase();
  
  // Extract key terms from the question (remove common words)
  const stopWords = new Set([
    "was", "wie", "warum", "wann", "wo", "welche", "welcher", "welches", "wer",
    "ist", "sind", "hat", "haben", "kann", "können", "soll", "sollte", "muss",
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "einem",
    "und", "oder", "aber", "auch", "bei", "mit", "von", "zu", "für", "auf",
    "man", "es", "ich", "du", "er", "sie", "wir", "ihr", "mein", "dein",
    "gibt", "braucht", "macht", "tut", "wird", "werden", "wurde", "wurden",
  ]);
  
  const words = questionLower
    .replace(/[?!.,;:'"„"]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  // Check 1: Exact question match (without question mark)
  const questionWithoutMark = questionLower.replace("?", "").trim();
  if (fullContentLower.includes(questionWithoutMark)) {
    const evidence = findEvidence(originalContent, questionWithoutMark);
    return {
      question,
      status: "found",
      matchType: "exact",
      evidence,
      confidence: 100,
    };
  }

  // Check 2: All key terms present in close proximity
  const keyTermsFound = words.filter(w => fullContentLower.includes(w));
  const keyTermRatio = words.length > 0 ? keyTermsFound.length / words.length : 0;

  if (keyTermRatio >= 0.8 && words.length >= 2) {
    // Check if terms appear within reasonable proximity (same paragraph)
    const paragraphs = originalContent.split(/\n\n+/);
    for (const para of paragraphs) {
      const paraLower = para.toLowerCase();
      const termsInPara = words.filter(w => paraLower.includes(w));
      if (termsInPara.length >= words.length * 0.7) {
        return {
          question,
          status: "found",
          matchType: "similar",
          evidence: para.slice(0, 200) + (para.length > 200 ? "..." : ""),
          confidence: Math.round(keyTermRatio * 90),
        };
      }
    }
  }

  // Check 3: Partial match - some key terms found
  if (keyTermRatio >= 0.5) {
    const evidence = findEvidenceByTerms(originalContent, keyTermsFound);
    return {
      question,
      status: "partial",
      matchType: "similar",
      evidence,
      confidence: Math.round(keyTermRatio * 60),
    };
  }

  // Check 4: Very low or no match
  if (keyTermRatio > 0) {
    return {
      question,
      status: "missing",
      matchType: "none",
      confidence: Math.round(keyTermRatio * 30),
    };
  }

  return {
    question,
    status: "missing",
    matchType: "none",
    confidence: 0,
  };
}

function findEvidence(content: string, searchTerm: string): string {
  const lowerContent = content.toLowerCase();
  const index = lowerContent.indexOf(searchTerm.toLowerCase());
  
  if (index === -1) return "";
  
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + searchTerm.length + 150);
  
  let evidence = content.slice(start, end);
  if (start > 0) evidence = "..." + evidence;
  if (end < content.length) evidence = evidence + "...";
  
  return evidence;
}

function findEvidenceByTerms(content: string, terms: string[]): string {
  const lowerContent = content.toLowerCase();
  
  // Find the paragraph with most term matches
  const paragraphs = content.split(/\n\n+/);
  let bestPara = "";
  let bestCount = 0;
  
  for (const para of paragraphs) {
    const paraLower = para.toLowerCase();
    const count = terms.filter(t => paraLower.includes(t)).length;
    if (count > bestCount) {
      bestCount = count;
      bestPara = para;
    }
  }
  
  if (bestPara) {
    return bestPara.slice(0, 200) + (bestPara.length > 200 ? "..." : "");
  }
  
  // Fallback: find first occurrence of any term
  for (const term of terms) {
    const index = lowerContent.indexOf(term);
    if (index !== -1) {
      return findEvidence(content, term);
    }
  }
  
  return "";
}

async function performSemanticCheck(
  questions: string[],
  content: string
): Promise<FAQCheckResult[]> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Truncate content if too long
    const truncatedContent = content.slice(0, 8000);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Du bist ein SEO-Analyst. Prüfe ob die gegebenen Fragen im Content beantwortet werden.
          
Beachte:
- Die Frage muss nicht wörtlich vorkommen
- Prüfe ob die ANTWORT auf die Frage im Content enthalten ist
- Auch umformulierte oder teilweise Antworten zählen
- Sei präzise und fair in der Bewertung`
        },
        {
          role: "user",
          content: `Prüfe ob folgende Fragen im Content beantwortet werden:

FRAGEN:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

CONTENT:
${truncatedContent}

Antworte als JSON-Array:
[
  {
    "question": "Die Frage",
    "answered": true/false,
    "confidence": 0-100,
    "evidence": "Kurzer Textausschnitt als Beleg (max 150 Zeichen)" oder null
  }
]

Nur das JSON-Array, keine Erklärungen.`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseContent = completion.choices[0]?.message?.content || "[]";
    
    // Parse response
    const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    const aiResults = JSON.parse(jsonMatch[0]);
    
    return aiResults.map((r: { question: string; answered: boolean; confidence: number; evidence?: string }) => ({
      question: r.question,
      status: r.answered ? (r.confidence >= 70 ? "found" : "partial") : "missing",
      matchType: r.answered ? "semantic" : "none",
      evidence: r.evidence || undefined,
      confidence: r.confidence,
    }));
    
  } catch (error) {
    console.error("Semantic check failed:", error);
    return [];
  }
}
