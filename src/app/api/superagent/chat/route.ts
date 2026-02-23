import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiRateLimiter } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import {
  fetchRankings,
  fetchSearchVolume,
  fetchBacklinks,
  fetchBacklinksSummary,
  fetchReferringDomains,
  findRankingPosition,
} from "@/lib/dataforseo";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Tool definitions for Claude
const tools: Anthropic.Tool[] = [
  {
    name: "search_rankings",
    description:
      "Ruft die aktuellen Google-Rankings für Keywords ab. Zeigt die Position in den Suchergebnissen für targobank.de. Ideal für Fragen wie 'Auf welcher Position rankt targobank.de für [keyword]?' oder 'Wie sind die Rankings für diese Keywords?'",
    input_schema: {
      type: "object" as const,
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Liste der Keywords, für die Rankings abgerufen werden sollen",
        },
        location: {
          type: "string",
          description: "Land für die Suche (Standard: Germany)",
          default: "Germany",
        },
      },
      required: ["keywords"],
    },
  },
  {
    name: "get_search_volume",
    description:
      "Ruft das monatliche Suchvolumen für Keywords ab. Zeigt, wie oft ein Keyword pro Monat gesucht wird, sowie CPC und Wettbewerb. Ideal für Keyword-Recherche und Priorisierung.",
    input_schema: {
      type: "object" as const,
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Liste der Keywords für die Suchvolumen-Abfrage",
        },
      },
      required: ["keywords"],
    },
  },
  {
    name: "analyze_backlinks",
    description:
      "Analysiert das Backlink-Profil von targobank.de. Zeigt die stärksten Backlinks, deren Quellen und Metriken. Ideal für Fragen wie 'Welche Backlinks hat targobank.de?' oder 'Zeig mir die Top-Backlinks'.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Anzahl der Backlinks (Standard: 20, Max: 100)",
          default: 20,
        },
        dofollow_only: {
          type: "boolean",
          description: "Nur dofollow-Links anzeigen",
          default: false,
        },
      },
      required: [],
    },
  },
  {
    name: "get_backlinks_summary",
    description:
      "Ruft eine Zusammenfassung des Backlink-Profils von targobank.de ab. Zeigt Gesamtzahl der Backlinks, verweisende Domains, dofollow/nofollow-Verhältnis etc.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_referring_domains",
    description:
      "Zeigt die verweisenden Domains für targobank.de. Listet auf, welche Websites auf targobank.de verlinken und wie stark diese sind.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Anzahl der Domains (Standard: 20, Max: 100)",
          default: 20,
        },
      },
      required: [],
    },
  },
];

// Execute a tool based on name and input
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case "search_rankings": {
        const keywords = (toolInput.keywords as string[]) || [];
        const location = (toolInput.location as string) || "Germany";

        if (keywords.length === 0) {
          return JSON.stringify({ error: "Keine Keywords angegeben" });
        }

        const keywordsWithTarget = keywords.map((k) => ({
          keyword: k,
          targetUrl: "targobank.de",
        }));

        const results = await fetchRankings(keywordsWithTarget, location);

        // Finde Positionen für jedes Keyword
        const rankings = keywords.map((keyword) => {
          const position = findRankingPosition(results, keyword, "targobank.de");
          return {
            keyword,
            position: position.position,
            url: position.url,
            found: position.position !== null,
          };
        });

        return JSON.stringify({
          success: true,
          location,
          rankings,
          summary: `${rankings.filter((r) => r.found).length} von ${keywords.length} Keywords gefunden`,
        });
      }

      case "get_search_volume": {
        const keywords = (toolInput.keywords as string[]) || [];

        if (keywords.length === 0) {
          return JSON.stringify({ error: "Keine Keywords angegeben" });
        }

        const results = await fetchSearchVolume(keywords);

        const volumeData = results.map((r) => ({
          keyword: r.keyword,
          search_volume: r.search_volume,
          competition: r.competition,
          cpc: r.cpc,
        }));

        return JSON.stringify({
          success: true,
          data: volumeData,
          total_keywords: volumeData.length,
        });
      }

      case "analyze_backlinks": {
        const limit = (toolInput.limit as number) || 20;
        const dofollowOnly = (toolInput.dofollow_only as boolean) || false;

        const results = await fetchBacklinks(
          limit,
          0,
          "rank,desc",
          dofollowOnly ? { dofollow: true } : undefined
        );

        const backlinks = results.items.map((item) => ({
          source_domain: item.domain_from,
          source_url: item.url_from,
          target_url: item.url_to,
          anchor: item.anchor,
          dofollow: item.dofollow,
          domain_rank: item.domain_from_rank,
          first_seen: item.first_seen,
        }));

        return JSON.stringify({
          success: true,
          total_count: results.total_count,
          returned: backlinks.length,
          backlinks,
        });
      }

      case "get_backlinks_summary": {
        const summary = await fetchBacklinksSummary();

        return JSON.stringify({
          success: true,
          summary: {
            total_backlinks: summary.total_backlinks,
            referring_domains: summary.total_referring_domains,
            referring_main_domains: summary.total_referring_main_domains,
            dofollow: summary.dofollow,
            nofollow: summary.nofollow,
            new_backlinks: summary.new_backlinks,
            lost_backlinks: summary.lost_backlinks,
          },
        });
      }

      case "get_referring_domains": {
        const limit = (toolInput.limit as number) || 20;

        const results = await fetchReferringDomains(limit);

        const domains = results.items.map((item) => ({
          domain: item.domain,
          rank: item.rank,
          backlinks: item.backlinks,
          first_seen: item.first_seen,
        }));

        return JSON.stringify({
          success: true,
          total_count: results.total_count,
          returned: domains.length,
          domains,
        });
      }

      default:
        return JSON.stringify({ error: `Unbekanntes Tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`[SuperAgent] Tool Error (${toolName}):`, error);
    return JSON.stringify({
      error: `Fehler bei ${toolName}: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
    });
  }
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

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array required" },
        { status: 400 }
      );
    }

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })
    );

    // System prompt for the SEO Agent
    const systemPrompt = `Du bist ein erfahrener SEO-Experte und Analyst für targobank.de. Du hilfst bei der Analyse von:
- Keyword-Rankings und Sichtbarkeit in Google
- Suchvolumen und Keyword-Recherche
- Backlink-Profil und Link-Building
- SEO-Strategie und Empfehlungen

Du hast Zugriff auf Echtzeit-Daten von DataForSEO.

REGELN FÜR TOOL-NUTZUNG:
1. Rufe jedes Tool MAXIMAL EINMAL pro Anfrage auf
2. Nach Erhalt von Tool-Ergebnissen: Analysiere und antworte SOFORT - rufe KEINE weiteren Tools auf
3. Fasse die Ergebnisse zusammen und gib Empfehlungen basierend auf den erhaltenen Daten

KEYWORD-ERWEITERUNG (erlaubt, aber begrenzt):
- Du darfst die Keywords des Nutzers um MAXIMAL 3 thematisch verwandte Keywords ergänzen
- Beispiel: Nutzer fragt nach "Kredit" → du kannst "Kredit", "Kreditzinsen", "Kredit Deutschland", "Kreditvergleich" abfragen (4 total)
- Erweitere NUR wenn es für eine bessere Analyse sinnvoll ist
- Bei allgemeinen Fragen ohne Keywords: Frage den Nutzer nach spezifischen Keywords statt eigene zu erfinden

Wichtige Hinweise:
- Alle Analysen beziehen sich auf den deutschen Markt (Deutschland)
- Antworte auf Deutsch
- Sei präzise und datengetrieben
- Gib konkrete Handlungsempfehlungen

Wenn der Nutzer nach Rankings, Suchvolumen oder Backlinks fragt, nutze die verfügbaren Tools um echte Daten abzurufen - aber NUR EINMAL pro Tool.`;

    // Track tool usage to prevent duplicates
    const usedTools = new Set<string>();
    const MAX_TOOL_ITERATIONS = 3; // Maximum number of tool rounds (allows for combined queries)
    let toolIterations = 0;

    let response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: anthropicMessages,
    });

    // Handle tool use - loop with strict limits
    while (response.stop_reason === "tool_use" && toolIterations < MAX_TOOL_ITERATIONS) {
      toolIterations++;
      console.log(`[SuperAgent] Tool iteration ${toolIterations}/${MAX_TOOL_ITERATIONS}`);

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        // Create a unique key for this tool call (tool name + input hash)
        const toolKey = `${toolUse.name}:${JSON.stringify(toolUse.input)}`;
        
        if (usedTools.has(toolKey)) {
          console.log(`[SuperAgent] Skipping duplicate tool call: ${toolUse.name}`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ 
              error: "Diese Abfrage wurde bereits durchgeführt. Bitte nutze die vorhandenen Ergebnisse.",
              cached: true 
            }),
          });
          continue;
        }

        // Track how many times each tool type was used (allow up to 2 calls per tool)
        const toolTypeKey = `tooltype:${toolUse.name}`;
        const toolTypeCount = Array.from(usedTools).filter(k => k.startsWith(toolTypeKey)).length;
        if (toolTypeCount >= 2) {
          console.log(`[SuperAgent] Tool ${toolUse.name} already used ${toolTypeCount} times, blocking`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ 
              error: `Das Tool "${toolUse.name}" wurde bereits ${toolTypeCount}x verwendet. Bitte analysiere die vorhandenen Daten.`,
              already_called: true 
            }),
          });
          continue;
        }

        console.log(`[SuperAgent] Executing tool: ${toolUse.name}`);
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );
        
        usedTools.add(toolKey);
        usedTools.add(`tooltype:${toolUse.name}:${toolTypeCount + 1}`); // Track tool type usage count
        
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Continue the conversation with tool results
      response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: [
          ...anthropicMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults },
        ],
      });
    }

    // If we hit the iteration limit, log it
    if (toolIterations >= MAX_TOOL_ITERATIONS && response.stop_reason === "tool_use") {
      console.log(`[SuperAgent] Hit max tool iterations (${MAX_TOOL_ITERATIONS}), forcing response`);
    }

    // Extract text from response
    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    return NextResponse.json({
      message: textContent?.text || "Keine Antwort erhalten",
      usage: response.usage,
    });
  } catch (error) {
    console.error("[SuperAgent] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
      },
      { status: 500 }
    );
  }
}
