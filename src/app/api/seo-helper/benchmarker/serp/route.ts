import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRateLimiter } from "@/lib/rate-limit";

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

// Base64 encode credentials for Basic Auth
function getAuthHeader(): string {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!username || !password) {
    throw new Error("DATAFORSEO_USERNAME und DATAFORSEO_PASSWORD müssen in der .env Datei gesetzt sein");
  }

  const credentials = `${username}:${password}`;
  const encoded = Buffer.from(credentials).toString("base64");
  return `Basic ${encoded}`;
}

interface SerpItem {
  type: string;
  rank_group: number;
  rank_absolute: number;
  position: string;
  domain: string;
  title: string;
  url: string;
  description: string;
  breadcrumb: string;
  is_featured_snippet: boolean;
  is_paid: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success, remaining, resetIn } = apiRateLimiter.check(session.user.id);
    if (!success) {
      return NextResponse.json(
        { error: `Rate limit erreicht. Bitte warte ${resetIn} Sekunden.` },
        { status: 429, headers: { "Retry-After": String(resetIn), "X-RateLimit-Remaining": "0" } }
      );
    }

    const { keyword } = await request.json();

    if (!keyword || typeof keyword !== "string" || !keyword.trim()) {
      return NextResponse.json(
        { error: "Keyword ist erforderlich" },
        { status: 400 }
      );
    }

    console.log(`[Benchmarker SERP] Suche Top 10 für: "${keyword.trim()}"`);

    // SERP-Abfrage mit DataForSEO Live API - Schweiz
    const requestBody = [{
      keyword: keyword.trim(),
      location_code: 2276, // Deutschland
      language_code: "de",
      depth: 10, // Top 10
    }];

    const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/organic/live/advanced`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Benchmarker SERP] API Fehler: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `DataForSEO API Fehler: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (data.tasks && data.tasks.length > 0) {
      const task = data.tasks[0];
      console.log(`[Benchmarker SERP] Response Status: ${task.status_code} (${task.status_message})`);

      if (task.status_code === 20000 && task.result && task.result.length > 0) {
        const result = task.result[0];
        
        // Filtere nur organische Ergebnisse (keine Ads, Featured Snippets etc.)
        const organicResults: SerpItem[] = (result.items || [])
          .filter((item: SerpItem) => 
            item.type === "organic" && 
            !item.is_paid && 
            item.url && 
            item.title
          )
          .slice(0, 10)
          .map((item: SerpItem, index: number) => ({
            rank: index + 1,
            title: item.title,
            url: item.url,
            domain: item.domain,
            description: item.description || "",
            breadcrumb: item.breadcrumb || "",
          }));

        console.log(`[Benchmarker SERP] ✓ ${organicResults.length} organische Ergebnisse gefunden`);

        return NextResponse.json({
          keyword: keyword.trim(),
          results: organicResults,
          totalCount: result.items_count || 0,
        });
      } else {
        console.warn(`[Benchmarker SERP] ✗ Keine Ergebnisse: ${task.status_message}`);
        return NextResponse.json(
          { error: "Keine Suchergebnisse gefunden" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Unerwartete API-Antwort" },
      { status: 500 }
    );
  } catch (error) {
    console.error("[Benchmarker SERP] Fehler:", error);
    return NextResponse.json(
      { error: "Fehler bei der SERP-Abfrage" },
      { status: 500 }
    );
  }
}
