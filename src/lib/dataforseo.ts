// DataForSEO API Integration für Rank Tracking

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

export interface RankTrackerTask {
  keyword: string;
  location_name?: string;
  location_code?: number;
  language_name?: string;
  language_code?: string;
  se_domain?: string;
  target?: string;
  tag?: string;
  depth?: number; // Anzahl der Suchergebnisse (Standard: 10, Max: 700)
}

export interface RankTrackerResult {
  keyword: string;
  location_name: string;
  language_name: string;
  check_url: string;
  datetime: string;
  items_count: number;
  items: Array<{
    type: string;
    rank_group: number;
    rank_absolute: number;
    position: string;
    xpath: string;
    domain: string;
    title: string;
    url: string;
    breadcrumb: string;
    website_name: string;
    is_featured_snippet: boolean;
    is_paid: boolean;
  }>;
}

/**
 * Erstellt eine neue Rank Tracker Task bei DataForSEO
 */
export async function createRankTrackerTask(
  tasks: RankTrackerTask[]
): Promise<{
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
  }>;
}> {
  const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/organic/task_post`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tasks),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Ruft die Ergebnisse einer Rank Tracker Task ab
 */
export async function getRankTrackerResults(
  taskIds: string[]
): Promise<{
  tasks: Array<{
    id: string;
    status_code: number;
    status_message: string;
    result: RankTrackerResult[] | null;
  }>;
}> {
  console.log(`[getRankTrackerResults] Rufe Ergebnisse für ${taskIds.length} Tasks ab:`, taskIds);
  
  const response = await fetch(`${DATAFORSEO_API_URL}/serp/google/organic/task_get/advanced/${taskIds.join(",")}`, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[getRankTrackerResults] API Fehler: ${response.status} - ${errorText}`);
    throw new Error(`DataForSEO API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[getRankTrackerResults] API Response:`, {
    tasksCount: data.tasks?.length || 0,
    requestedTaskIds: taskIds.length,
    returnedTaskIds: data.tasks?.map((t: any) => t.id) || [],
  });
  
  return data;
}

/**
 * Ruft Rankings für Keywords ab - verwendet den LIVE Endpunkt für sofortige Ergebnisse
 */
export async function fetchRankings(
  keywords: Array<{ keyword: string; targetUrl?: string | null }>,
  location: string = "Germany",
  language: string = "German"
): Promise<RankTrackerResult[]> {
  // ERZWINGE IMMER Deutschland - ignoriere übergebene Location
  const forcedLocation = "Germany";
  const forcedLanguage = language || "German";
  
  console.log(`[fetchRankings] Location Parameter: "${location}", ERZWUNGEN: "${forcedLocation}"`);
  
  const locationCodeMap: Record<string, number> = {
    Switzerland: 2756,
    Germany: 2276,
    "United States": 2840,
  };
  
  const languageCodeMap: Record<string, string> = {
    German: "de",
    English: "en",
    French: "fr",
    Italian: "it",
  };

  const locationCode = locationCodeMap[forcedLocation] || 2276;
  const languageCode = languageCodeMap[forcedLanguage] || "de";
  
  console.log(`[fetchRankings] Verwende Location Code: ${locationCode} (Deutschland), Language Code: ${languageCode}`);
  console.log(`[fetchRankings] Verarbeite ${keywords.length} Keywords mit LIVE API...`);

  const allResults: RankTrackerResult[] = [];
  
  // Verarbeite jedes Keyword einzeln mit dem Live-Endpunkt
  for (let i = 0; i < keywords.length; i++) {
    const item = keywords[i];
    console.log(`[fetchRankings] ====== Keyword ${i + 1}/${keywords.length}: "${item.keyword}" ======`);
    
    try {
      const requestBody = [{
        keyword: item.keyword,
        location_code: locationCode,
        language_code: languageCode,
        depth: 50,
      }];
      
      console.log(`[fetchRankings] Sende Live-Request für "${item.keyword}"...`);
      
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
        console.error(`[fetchRankings] API Fehler für "${item.keyword}": ${response.status} - ${errorText}`);
        continue; // Weiter mit nächstem Keyword
      }

      const data = await response.json();
      
      if (data.tasks && data.tasks.length > 0) {
        const task = data.tasks[0];
        console.log(`[fetchRankings] Response für "${item.keyword}": Status ${task.status_code} (${task.status_message})`);
        
        if (task.status_code === 20000 && task.result && task.result.length > 0) {
          const result = task.result[0];
          console.log(`[fetchRankings] ✓ "${item.keyword}": ${result.items_count} Items gefunden`);
          
          // Logge die ersten 5 Items
          if (result.items && result.items.length > 0) {
            console.log(`[fetchRankings] Top 5 Items für "${item.keyword}":`, 
              result.items.slice(0, 5).map((item: { rank_absolute: number; domain: string; url: string }) => ({
                rank: item.rank_absolute,
                domain: item.domain,
                url: item.url?.substring(0, 60)
              }))
            );
          }
          
          allResults.push(result);
        } else {
          console.warn(`[fetchRankings] ✗ Keine Ergebnisse für "${item.keyword}": ${task.status_message}`);
        }
      }
      
      // Kurze Pause zwischen Requests um Rate-Limits zu vermeiden
      if (i < keywords.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error(`[fetchRankings] Fehler bei "${item.keyword}":`, error);
      // Weiter mit nächstem Keyword
    }
  }
  
  console.log(`[fetchRankings] ====== Alle Keywords verarbeitet ======`);
  console.log(`[fetchRankings] Gesamt Results: ${allResults.length} für ${keywords.length} Keywords`);
  console.log(`[fetchRankings] Results Keywords:`, allResults.map(r => r.keyword));
  
  if (allResults.length > 0) {
    console.log(`[fetchRankings] ✓ Erfolgreich ${allResults.length} Results abgerufen`);
    return allResults;
  }

  console.error(`[fetchRankings] ✗ Keine Results abgerufen`);
  throw new Error("Keine Rankings gefunden");
}

// ==========================================
// SEARCH VOLUME API
// ==========================================

export interface SearchVolumeResult {
  keyword: string;
  search_volume: number | null;
  competition: string | null;
  competition_index: number | null;
  cpc: number | null;
  low_top_of_page_bid: number | null;
  high_top_of_page_bid: number | null;
  monthly_searches: Array<{
    year: number;
    month: number;
    search_volume: number;
  }> | null;
}

/**
 * Ruft das Suchvolumen für Keywords ab - verwendet den LIVE Endpunkt
 * Basiert auf: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/
 * HINWEIS: Location wird IMMER auf Deutschland gesetzt, unabhängig vom übergebenen Parameter
 */
export async function fetchSearchVolume(
  keywords: string[],
  location: string = "Germany",
  language: string = "German"
): Promise<SearchVolumeResult[]> {
  // ERZWINGE IMMER Deutschland - ignoriere übergebene Location (wie bei fetchRankings)
  const forcedLocation = "Germany";
  const forcedLanguage = language || "German";

  // Location und Language Codes
  const locationCodeMap: Record<string, number> = {
    Switzerland: 2756,
    Germany: 2276,
    "United States": 2840,
  };

  const languageCodeMap: Record<string, string> = {
    German: "de",
    English: "en",
    French: "fr",
    Italian: "it",
  };

  const locationCode = locationCodeMap[forcedLocation] || 2276;
  const languageCode = languageCodeMap[forcedLanguage] || "de";

  console.log(`[fetchSearchVolume] Rufe Suchvolumen für ${keywords.length} Keywords ab`);
  console.log(`[fetchSearchVolume] Location Parameter: "${location}", ERZWUNGEN: "${forcedLocation}"`);
  console.log(`[fetchSearchVolume] Location Code: ${locationCode} (Deutschland), Language Code: ${languageCode}`);

  // Die API unterstützt maximal 1000 Keywords pro Request
  // Wir teilen die Keywords in Batches von 100 auf
  const batchSize = 100;
  const allResults: SearchVolumeResult[] = [];

  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);
    console.log(`[fetchSearchVolume] Verarbeite Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(keywords.length / batchSize)}`);

    try {
      const requestBody = [{
        keywords: batch,
        location_code: 2276, // Deutschland - HARDCODED
        location_name: "Germany",
        language_code: "de",
        language_name: "German",
      }];

      console.log(`[fetchSearchVolume] Request Body:`, JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${DATAFORSEO_API_URL}/keywords_data/google_ads/search_volume/live`, {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fetchSearchVolume] API Fehler: ${response.status} - ${errorText}`);
        continue; // Weiter mit nächstem Batch
      }

      const data = await response.json();

      if (data.tasks && data.tasks.length > 0) {
        const task = data.tasks[0];
        console.log(`[fetchSearchVolume] Response Status: ${task.status_code} (${task.status_message})`);

        if (task.status_code === 20000 && task.result && task.result.length > 0) {
          const results = task.result as (SearchVolumeResult & { location_code?: number })[];
          console.log(`[fetchSearchVolume] ✓ ${results.length} Suchvolumen-Ergebnisse erhalten`);
          
          // Logge die ersten 5 Ergebnisse mit Location Code zur Überprüfung
          results.slice(0, 5).forEach((r) => {
            console.log(`[fetchSearchVolume]   "${r.keyword}": ${r.search_volume || 0} monatliche Suchen (Location: ${r.location_code || 'N/A'})`);
          });

          allResults.push(...results);
        } else {
          console.warn(`[fetchSearchVolume] ✗ Keine Ergebnisse: ${task.status_message}`);
        }
      }

      // Kurze Pause zwischen Batches um Rate-Limits zu vermeiden
      if (i + batchSize < keywords.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`[fetchSearchVolume] Fehler bei Batch:`, error);
      // Weiter mit nächstem Batch
    }
  }

  console.log(`[fetchSearchVolume] ====== Fertig ======`);
  console.log(`[fetchSearchVolume] Gesamt: ${allResults.length} Ergebnisse für ${keywords.length} Keywords`);

  return allResults;
}

// ==========================================
// BACKLINKS API
// ==========================================

export interface BacklinkItem {
  type: string;
  domain_from: string;
  url_from: string;
  url_from_https: boolean;
  domain_to: string;
  url_to: string;
  url_to_https: boolean;
  tld_from: string;
  is_new: boolean;
  is_lost: boolean;
  backlink_spam_score: number;
  rank: number;
  page_from_rank: number;
  domain_from_rank: number;
  domain_from_platform_type: string[] | null;
  domain_from_is_ip: boolean;
  domain_from_ip: string | null;
  domain_from_country: string | null;
  page_from_external_links: number;
  page_from_internal_links: number;
  page_from_size: number;
  page_from_encoding: string | null;
  page_from_language: string | null;
  page_from_title: string | null;
  page_from_status_code: number;
  first_seen: string;
  prev_seen: string | null;
  last_seen: string;
  item_type: string;
  attributes: string[] | null;
  dofollow: boolean;
  original: boolean;
  alt: string | null;
  image_url: string | null;
  anchor: string | null;
  text_pre: string | null;
  text_post: string | null;
  semantic_location: string | null;
  links_count: number;
  group_count: number;
  is_broken: boolean;
  url_to_status_code: number;
  url_to_spam_score: number;
  url_to_redirect_target: string | null;
  ranked_keywords_info: {
    page_from_keywords_count_top_3: number;
    page_from_keywords_count_top_10: number;
    page_from_keywords_count_top_100: number;
  } | null;
  is_indirect_link: boolean;
  indirect_link_path: string[] | null;
}

export interface BacklinksSummary {
  target: string;
  total_backlinks: number;
  total_referring_domains: number;
  total_referring_main_domains: number;
  total_referring_ips: number;
  total_referring_subnets: number;
  dofollow: number;
  nofollow: number;
  new_backlinks: number;
  lost_backlinks: number;
}

export interface BacklinksResult {
  target: string;
  total_count: number;
  items_count: number;
  items: BacklinkItem[];
}

/**
 * Ruft das Backlink-Profil für targobank.de ab
 * Verwendet den Backlinks Live Endpunkt: https://docs.dataforseo.com/v3/backlinks/backlinks/live/
 */
export async function fetchBacklinks(
  limit: number = 100,
  offset: number = 0,
  orderBy: string = "rank,desc",
  filters?: { dofollow?: boolean; isLost?: boolean; isNew?: boolean }
): Promise<BacklinksResult> {
  // Target ist IMMER targobank.de - keine andere Domain erlaubt
  const target = "targobank.de";
  
  console.log(`[fetchBacklinks] Rufe Backlinks für ${target} ab (Limit: ${limit}, Offset: ${offset})`);

  // Baue Filter-Array auf
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterArray: any[] = [];
  
  if (filters?.dofollow !== undefined) {
    filterArray.push(["dofollow", "=", filters.dofollow]);
  }
  
  if (filters?.isLost !== undefined) {
    filterArray.push(["is_lost", "=", filters.isLost]);
  }
  
  if (filters?.isNew !== undefined) {
    filterArray.push(["is_new", "=", filters.isNew]);
  }

  const requestBody = [{
    target,
    limit,
    offset,
    order_by: [orderBy],
    backlinks_status_type: "live",
    include_subdomains: true,
    ...(filterArray.length > 0 ? { filters: filterArray } : {}),
  }];

  console.log(`[fetchBacklinks] Request Body:`, JSON.stringify(requestBody, null, 2));

  const response = await fetch(`${DATAFORSEO_API_URL}/backlinks/backlinks/live`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fetchBacklinks] API Fehler: ${response.status} - ${errorText}`);
    throw new Error(`DataForSEO Backlinks API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.tasks && data.tasks.length > 0) {
    const task = data.tasks[0];
    console.log(`[fetchBacklinks] Response Status: ${task.status_code} (${task.status_message})`);

    if (task.status_code === 20000 && task.result && task.result.length > 0) {
      const result = task.result[0];
      console.log(`[fetchBacklinks] ✓ ${result.items_count} Backlinks von ${result.total_count} gesamt abgerufen`);
      
      return result;
    } else {
      console.warn(`[fetchBacklinks] ✗ Keine Ergebnisse: ${task.status_message}`);
      throw new Error(`Keine Backlinks gefunden: ${task.status_message}`);
    }
  }

  throw new Error("Unerwartete API-Antwort");
}

/**
 * Ruft eine Zusammenfassung des Backlink-Profils für targobank.de ab
 * Verwendet den Backlinks Summary Endpunkt
 */
export async function fetchBacklinksSummary(): Promise<BacklinksSummary> {
  // Target ist IMMER targobank.de - keine andere Domain erlaubt
  const target = "targobank.de";
  
  console.log(`[fetchBacklinksSummary] Rufe Backlinks-Summary für ${target} ab`);

  const requestBody = [{
    target,
    include_subdomains: true,
  }];

  const response = await fetch(`${DATAFORSEO_API_URL}/backlinks/summary/live`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fetchBacklinksSummary] API Fehler: ${response.status} - ${errorText}`);
    throw new Error(`DataForSEO Backlinks Summary API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.tasks && data.tasks.length > 0) {
    const task = data.tasks[0];
    console.log(`[fetchBacklinksSummary] Response Status: ${task.status_code} (${task.status_message})`);

    if (task.status_code === 20000 && task.result && task.result.length > 0) {
      const result = task.result[0];
      console.log(`[fetchBacklinksSummary] ✓ Summary abgerufen:`, {
        total_backlinks: result.backlinks,
        referring_domains: result.referring_domains,
        dofollow: result.backlinks_dofollow,
        nofollow: result.backlinks_nofollow,
      });
      
      return {
        target,
        total_backlinks: result.backlinks || 0,
        total_referring_domains: result.referring_domains || 0,
        total_referring_main_domains: result.referring_main_domains || 0,
        total_referring_ips: result.referring_ips || 0,
        total_referring_subnets: result.referring_subnets || 0,
        dofollow: result.backlinks_dofollow || 0,
        nofollow: result.backlinks_nofollow || 0,
        new_backlinks: result.backlinks_new || 0,
        lost_backlinks: result.backlinks_lost || 0,
      };
    } else {
      console.warn(`[fetchBacklinksSummary] ✗ Keine Ergebnisse: ${task.status_message}`);
      throw new Error(`Keine Backlinks-Summary gefunden: ${task.status_message}`);
    }
  }

  throw new Error("Unerwartete API-Antwort");
}

/**
 * Ruft Referring Domains für targobank.de ab
 */
export async function fetchReferringDomains(
  limit: number = 100,
  offset: number = 0,
  orderBy: string = "rank,desc"
): Promise<{ total_count: number; items_count: number; items: Array<{
  type: string;
  domain: string;
  rank: number;
  backlinks: number;
  first_seen: string;
  lost_date: string | null;
  backlinks_spam_score: number;
  broken_backlinks: number;
  broken_pages: number;
  referring_ips: number;
  referring_subnets: number;
  referring_pages: number;
  referring_links_tld: Record<string, number> | null;
  referring_links_types: Record<string, number> | null;
  referring_links_attributes: Record<string, number> | null;
  referring_links_platform_types: Record<string, number> | null;
  referring_links_semantic_locations: Record<string, number> | null;
  referring_links_countries: Record<string, number> | null;
}> }> {
  // Target ist IMMER targobank.de - keine andere Domain erlaubt
  const target = "targobank.de";
  
  console.log(`[fetchReferringDomains] Rufe Referring Domains für ${target} ab (Limit: ${limit}, Offset: ${offset})`);

  const requestBody = [{
    target,
    limit,
    offset,
    order_by: [orderBy],
    include_subdomains: true,
  }];

  const response = await fetch(`${DATAFORSEO_API_URL}/backlinks/referring_domains/live`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fetchReferringDomains] API Fehler: ${response.status} - ${errorText}`);
    throw new Error(`DataForSEO Referring Domains API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.tasks && data.tasks.length > 0) {
    const task = data.tasks[0];
    console.log(`[fetchReferringDomains] Response Status: ${task.status_code} (${task.status_message})`);

    if (task.status_code === 20000 && task.result && task.result.length > 0) {
      const result = task.result[0];
      console.log(`[fetchReferringDomains] ✓ ${result.items_count} Referring Domains von ${result.total_count} gesamt abgerufen`);
      
      return result;
    } else {
      console.warn(`[fetchReferringDomains] ✗ Keine Ergebnisse: ${task.status_message}`);
      throw new Error(`Keine Referring Domains gefunden: ${task.status_message}`);
    }
  }

  throw new Error("Unerwartete API-Antwort");
}

/**
 * Findet die Position einer URL in den Rankings
 * Sucht standardmäßig nach targobank.de URLs, wenn keine targetUrl angegeben ist
 */
export function findRankingPosition(
  results: RankTrackerResult[],
  keyword: string,
  targetUrl?: string
): { position: number | null; url: string | null } {
  console.log(`[findRankingPosition] Suche Rankings für Keyword: "${keyword}"`);
  console.log(`[findRankingPosition] Target URL: "${targetUrl || 'targobank.de (Standard)'}"`);
  console.log(`[findRankingPosition] Anzahl Results: ${results.length}`);
  
  const result = results.find((r) => r.keyword.toLowerCase() === keyword.toLowerCase());
  
  if (!result) {
    console.log(`[findRankingPosition] Kein Result gefunden für Keyword: "${keyword}"`);
    console.log(`[findRankingPosition] Verfügbare Keywords in Results:`, results.map(r => r.keyword));
    return { position: null, url: null };
  }
  
  if (!result.items || result.items.length === 0) {
    console.log(`[findRankingPosition] Keine Items im Result für Keyword: "${keyword}"`);
    return { position: null, url: null };
  }

  console.log(`[findRankingPosition] Gefundenes Result für Keyword: "${result.keyword}"`);
  console.log(`[findRankingPosition] Anzahl Items: ${result.items.length}`);
  console.log(`[findRankingPosition] Erste 10 Items:`, result.items.slice(0, 10).map((item, idx) => ({
    rank: item.rank_absolute,
    url: item.url,
    domain: item.domain,
    title: item.title?.substring(0, 50),
  })));

  // Standard: Suche nach targobank.de URLs
  const searchDomain = targetUrl || "targobank.de";

  // Extrahiere die Domain aus der targetUrl
  // z.B. "targobank.de", "www.targobank.de", "https://www.targobank.de/something" -> "targobank.de"
  let normalizedTarget = searchDomain.toLowerCase();
  
  // Entferne Protokoll
  normalizedTarget = normalizedTarget.replace(/^https?:\/\//, "");
  
  // Entferne www. Präfix
  normalizedTarget = normalizedTarget.replace(/^www\./, "");
  
  // Entferne Pfad und Query-Parameter (nur Domain behalten)
  normalizedTarget = normalizedTarget.split("/")[0].split("?")[0];
  
  // Entferne trailing slash
  normalizedTarget = normalizedTarget.replace(/\/$/, "");
  
  console.log(`[findRankingPosition] Normalisierte Target Domain: "${normalizedTarget}"`);
  
  // Suche nach URLs die die Domain enthalten
  const matchingItems: Array<{ item: typeof result.items[0]; normalizedUrl: string }> = [];
  
  // Logge alle Items für Debugging
  console.log(`[findRankingPosition] Prüfe ${result.items.length} Ranking-Items...`);
  
  result.items.forEach((item, index) => {
    // Prüfe ob item.url existiert
    if (!item.url) {
      console.log(`[findRankingPosition] Item ${index + 1}: Keine URL vorhanden`);
      return;
    }
    
    // Normalisiere die Item-URL für Vergleich
    let normalizedItemUrl = item.url.toLowerCase();
    
    // Entferne Protokoll
    normalizedItemUrl = normalizedItemUrl.replace(/^https?:\/\//, "");
    
    // Entferne www. Präfix für Vergleich
    normalizedItemUrl = normalizedItemUrl.replace(/^www\./, "");
    
    // Prüfe auch die Domain direkt
    const itemDomain = item.domain?.toLowerCase().replace(/^www\./, "") || "";
    
    // Prüfe ob die URL oder Domain die Target-Domain enthält
    // Wichtig: Prüfe auch ob die Domain mit der Target-Domain endet (z.B. "targobank.de" in "www.targobank.de")
    const urlMatches = normalizedItemUrl.includes(normalizedTarget);
    const domainMatches = itemDomain.includes(normalizedTarget) || itemDomain.endsWith(`.${normalizedTarget}`);
    const matches = urlMatches || domainMatches;
    
    if (index < 20) { // Logge nur die ersten 20 Items
      console.log(`[findRankingPosition] Item ${index + 1} (Rank ${item.rank_absolute}):`);
      console.log(`  Original URL: ${item.url}`);
      console.log(`  Domain: ${item.domain}`);
      console.log(`  Normalisiert URL: ${normalizedItemUrl}`);
      console.log(`  Normalisiert Domain: ${itemDomain}`);
      console.log(`  Target: "${normalizedTarget}"`);
      console.log(`  URL Match: ${urlMatches}, Domain Match: ${domainMatches}, Gesamt Match: ${matches}`);
    }
    
    if (matches) {
      matchingItems.push({ item, normalizedUrl: normalizedItemUrl });
      console.log(`[findRankingPosition] ✓ MATCH gefunden bei Position ${item.rank_absolute}: ${item.url}`);
    }
  });
  
  console.log(`[findRankingPosition] Gefundene Matches: ${matchingItems.length}`);
  
  if (matchingItems.length > 0) {
    // Nimm das erste Match (höchste Position = niedrigste rank_absolute Zahl)
    const bestMatch = matchingItems[0];
    console.log(`[findRankingPosition] ✓ Bestes Match gefunden:`);
    console.log(`  Position: ${bestMatch.item.rank_absolute}`);
    console.log(`  URL: ${bestMatch.item.url}`);
    console.log(`  Domain: ${bestMatch.item.domain}`);
    
    return {
      position: bestMatch.item.rank_absolute,
      url: bestMatch.item.url,
    };
  }

  console.log(`[findRankingPosition] ✗ Keine passende URL gefunden für Domain: "${normalizedTarget}"`);
  console.log(`[findRankingPosition] Alle gefundenen Domains (Top 20):`, [...new Set(result.items.slice(0, 20).map(i => i.domain))]);
  console.log(`[findRankingPosition] Alle gefundenen URLs (Top 20):`, result.items.slice(0, 20).map(i => i.url));
  
  // Wenn keine passende URL gefunden wurde, gib null zurück
  return { position: null, url: null };
}
