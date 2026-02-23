"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart, LineChart, PieChart } from "@/components/charts";
import { sanitizeHtml } from "@/lib/sanitize";

const KEYWORD_CATEGORIES = [
  "Konto & Karten",
  "Kredit & Finanzierung",
  "Sparen & Investieren",
  "Schutz & Vorsorge",
] as const;

interface KeywordData {
  id: string;
  keyword: string;
  category: string | null;
  targetUrl: string | null;
  searchVolume: number | null;
  currentPosition: number | null;
  previousPosition: number | null;
  firstPosition: number | null;
  deltaLast: number | null;
  deltaStart: number | null;
  latestUrl: string | null;
  latestDate: string | null;
  recentRankings: Array<{
    date: string;
    position: number | null;
    url: string | null;
  }>;
}

interface RankingStats {
  total: number;
  top3: number;
  top10: number;
  top20: number;
  top50: number;
  top100: number;
  notRanking: number;
  avgPosition: number;
  improved: number;
  declined: number;
  unchanged: number;
}

interface CategoryStat {
  category: string;
  total: number;
  ranking: number;
  top10: number;
  avgPosition: number | null;
}

interface TrendPoint {
  date: string;
  avgPosition: number;
  keywordsTracked: number;
}

interface RankingReportData {
  keywords: KeywordData[];
  stats: RankingStats;
  categoryStats: CategoryStat[];
  historicalTrend: TrendPoint[];
  topImprovers: KeywordData[];
  topDecliners: KeywordData[];
}

export default function RankingReportPage() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<RankingReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [days, setDays] = useState(90);
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"position" | "delta" | "volume" | "keyword">("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [aiReportError, setAiReportError] = useState<string | null>(null);
  const itemsPerPage = 25;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Daten laden
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (categoryFilter) params.set("category", categoryFilter);
        params.set("days", days.toString());

        const res = await fetch(`/api/reporting/ranking-report?${params}`);
        if (!res.ok) throw new Error("Fehler beim Laden der Daten");
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching ranking report:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [categoryFilter, days]);

  // Gefilterte und sortierte Keywords
  const filteredKeywords = useMemo(() => {
    if (!data) return [];

    let filtered = data.keywords;

    // Textsuche
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (kw) =>
          kw.keyword.toLowerCase().includes(search) ||
          kw.latestUrl?.toLowerCase().includes(search) ||
          kw.targetUrl?.toLowerCase().includes(search)
      );
    }

    // Sortierung
    filtered = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "position":
          const posA = a.currentPosition ?? 999;
          const posB = b.currentPosition ?? 999;
          return (posA - posB) * dir;
        case "delta":
          const deltaA = a.deltaLast ?? 0;
          const deltaB = b.deltaLast ?? 0;
          return (deltaB - deltaA) * dir;
        case "volume":
          const volA = a.searchVolume ?? 0;
          const volB = b.searchVolume ?? 0;
          return (volB - volA) * dir;
        case "keyword":
          return a.keyword.localeCompare(b.keyword) * dir;
        default:
          return 0;
      }
    });

    return filtered;
  }, [data, searchText, sortBy, sortDir]);

  // Paginierung
  const totalPages = Math.ceil(filteredKeywords.length / itemsPerPage);
  const paginatedKeywords = filteredKeywords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset Seite bei Filter-Änderung
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, categoryFilter, sortBy, sortDir]);

  // Chart-Daten
  const distributionData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Top 3", value: data.stats.top3 },
      { name: "Top 4-10", value: data.stats.top10 },
      { name: "Top 11-20", value: data.stats.top20 },
      { name: "Top 21-50", value: data.stats.top50 },
      { name: "Top 51-100", value: data.stats.top100 },
      { name: "Nicht rankend", value: data.stats.notRanking },
    ].filter((d) => d.value > 0);
  }, [data]);

  const categoryChartData = useMemo(() => {
    if (!data) return [];
    return data.categoryStats
      .sort((a, b) => b.total - a.total)
      .map((cat) => ({
        category: cat.category,
        "Top 10": cat.top10,
        Rankend: cat.ranking - cat.top10,
        "Nicht rankend": cat.total - cat.ranking,
      }));
  }, [data]);

  const trendData = useMemo(() => {
    if (!data || data.historicalTrend.length === 0) return [];
    return data.historicalTrend.map((point) => ({
      date: new Date(point.date).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
      }),
      "Ø Position": point.avgPosition,
      Keywords: point.keywordsTracked,
    }));
  }, [data]);

  const improversData = useMemo(() => {
    if (!data) return [];
    return data.topImprovers.map((kw) => ({
      keyword: kw.keyword.length > 25 ? kw.keyword.substring(0, 25) + "..." : kw.keyword,
      verbesserung: kw.deltaLast || 0,
    }));
  }, [data]);

  const declinersData = useMemo(() => {
    if (!data) return [];
    return data.topDecliners.map((kw) => ({
      keyword: kw.keyword.length > 25 ? kw.keyword.substring(0, 25) + "..." : kw.keyword,
      verschlechterung: Math.abs(kw.deltaLast || 0),
    }));
  }, [data]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir(column === "position" ? "asc" : "desc");
    }
  };

  const generateAiReport = async () => {
    if (!data) return;
    setIsGeneratingAiReport(true);
    setAiReportError(null);
    setAiReport(null);

    try {
      const response = await fetch("/api/reporting/ai-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ranking",
          rankingData: {
            stats: data.stats,
            categoryStats: data.categoryStats,
            topImprovers: data.topImprovers.slice(0, 10).map((kw) => ({
              keyword: kw.keyword,
              position: kw.currentPosition,
              delta: kw.deltaLast,
              category: kw.category,
              searchVolume: kw.searchVolume,
            })),
            topDecliners: data.topDecliners.slice(0, 10).map((kw) => ({
              keyword: kw.keyword,
              position: kw.currentPosition,
              delta: kw.deltaLast,
              category: kw.category,
              searchVolume: kw.searchVolume,
            })),
            topKeywords: data.keywords
              .filter((kw) => kw.currentPosition !== null)
              .sort((a, b) => (a.currentPosition || 999) - (b.currentPosition || 999))
              .slice(0, 20)
              .map((kw) => ({
                keyword: kw.keyword,
                position: kw.currentPosition,
                deltaLast: kw.deltaLast,
                deltaStart: kw.deltaStart,
                category: kw.category,
                searchVolume: kw.searchVolume,
                url: kw.latestUrl,
              })),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fehler beim Generieren des Reports");
      }

      const result = await response.json();
      setAiReport(result.report);
    } catch (error) {
      console.error("Error generating AI report:", error);
      setAiReportError(error instanceof Error ? error.message : "Unbekannter Fehler");
    } finally {
      setIsGeneratingAiReport(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/reporting"
            className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurück zu Reporting
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ranking Report</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyse und Auswertung der Ranktracker-Daten
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Kategorien</option>
            {KEYWORD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={30}>30 Tage</option>
            <option value={60}>60 Tage</option>
            <option value={90}>90 Tage</option>
            <option value={180}>180 Tage</option>
            <option value={365}>365 Tage</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : !data || data.stats.total === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Keine Keywords im Ranktracker</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Füge zuerst Keywords im Ranktracker hinzu, um einen Ranking Report zu erstellen.
          </p>
          <a
            href="/ranktracker"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Zum Ranktracker
          </a>
        </div>
      ) : (
        <>
          {/* Übersicht Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Keywords gesamt" value={data.stats.total} />
            <StatCard
              title="Ø Position"
              value={data.stats.avgPosition}
              format="position"
            />
            <StatCard
              title="Top 10"
              value={data.stats.top3 + data.stats.top10}
              subtitle={`${data.stats.top3} in Top 3`}
              trend="up"
            />
            <StatCard
              title="Verbessert"
              value={data.stats.improved}
              subtitle={`seit letztem Update`}
              trend="up"
            />
            <StatCard
              title="Verschlechtert"
              value={data.stats.declined}
              subtitle={`seit letztem Update`}
              trend="down"
            />
            <StatCard
              title="Nicht rankend"
              value={data.stats.notRanking}
            />
          </div>

          {/* Charts Row 1: Distribution & Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking-Verteilung */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Ranking-Verteilung</h3>
              {distributionData.length > 0 ? (
                <PieChart data={distributionData} height={300} />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  Keine Daten verfügbar
                </div>
              )}
            </div>

            {/* Historischer Trend */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Ø Position im Zeitverlauf
              </h3>
              {trendData.length > 0 ? (
                <LineChart
                  data={trendData}
                  xKey="date"
                  lines={[
                    { key: "Ø Position", name: "Ø Position", color: "#3b82f6" },
                  ]}
                  height={300}
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  Keine historischen Daten verfügbar
                </div>
              )}
            </div>
          </div>

          {/* Charts Row 2: Categories */}
          {categoryChartData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Keywords nach Kategorie
              </h3>
              <BarChart
                data={categoryChartData}
                xKey="category"
                yKey="Top 10"
                height={300}
              />
            </div>
          )}

          {/* Charts Row 3: Improvers & Decliners */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {improversData.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                  Top Gewinner
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Grösste Positionsverbesserungen seit letztem Update
                </p>
                <BarChart
                  data={improversData}
                  xKey="keyword"
                  yKey="verbesserung"
                  color="#10b981"
                  height={300}
                  horizontal
                />
              </div>
            )}

            {declinersData.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                  Top Verlierer
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Grösste Positionsverschlechterungen seit letztem Update
                </p>
                <BarChart
                  data={declinersData}
                  xKey="keyword"
                  yKey="verschlechterung"
                  color="#ef4444"
                  height={300}
                  horizontal
                />
              </div>
            )}
          </div>

          {/* KI-Report Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                  KI-generierter Ranking Report
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Generiere eine KI-Analyse der aktuellen Ranking-Situation mit Handlungsempfehlungen
                </p>
              </div>
              <button
                onClick={generateAiReport}
                disabled={isGeneratingAiReport}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium rounded-lg transition-all disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
              >
                {isGeneratingAiReport ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Generiere Report...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    <span>KI-Report generieren</span>
                  </>
                )}
              </button>
            </div>

            {aiReportError && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{aiReportError}</p>
              </div>
            )}

            {aiReport && (
              <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {aiReport.split("\n").map((line, i) => {
                      if (line.match(/^#{1,6}\s/)) {
                        const level = Math.min(line.match(/^#+/)?.[0].length || 1, 6);
                        let text = line.replace(/^#+\s/, "");
                        text = text.replace(/\*\*/g, "").replace(/\*/g, "");
                        const className = `font-bold text-slate-900 dark:text-white mt-6 mb-3 ${
                          level === 1 ? "text-2xl" : level === 2 ? "text-xl" : level === 3 ? "text-lg" : "text-base"
                        }`;
                        if (level === 1) return <h1 key={i} className={className}>{text}</h1>;
                        if (level === 2) return <h2 key={i} className={className}>{text}</h2>;
                        if (level === 3) return <h3 key={i} className={className}>{text}</h3>;
                        if (level === 4) return <h4 key={i} className={className}>{text}</h4>;
                        if (level === 5) return <h5 key={i} className={className}>{text}</h5>;
                        return <h6 key={i} className={className}>{text}</h6>;
                      }
                      if (line.match(/^[-*]\s/)) {
                        let listText = line.replace(/^[-*]\s/, "");
                        listText = listText.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-slate-900 dark:text-white'>$1</strong>");
                        listText = listText.replace(/\*(.*?)\*/g, "<em class='italic'>$1</em>");
                        listText = listText.replace(/\*(?![*<])/g, "");
                        return (
                          <div key={i} className="ml-4 mb-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(`<span class="text-slate-400">•</span> ${listText}`) }} />
                        );
                      }
                      if (line.trim()) {
                        let text = line;
                        text = text.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-slate-900 dark:text-white'>$1</strong>");
                        text = text.replace(/\*(.*?)\*/g, "<em class='italic'>$1</em>");
                        text = text.replace(/\*(?![*<])/g, "");
                        return <p key={i} className="mb-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />;
                      }
                      return <br key={i} />;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Keyword Tabelle */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Alle Keywords ({filteredKeywords.length})
                </h3>
                <div className="relative">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Keyword oder URL suchen..."
                    className="w-full sm:w-72 px-4 py-2 pl-10 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg
                    className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th
                      className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:text-slate-900 dark:hover:text-white"
                      onClick={() => handleSort("keyword")}
                    >
                      <div className="flex items-center gap-1">
                        Keyword
                        {sortBy === "keyword" && (
                          <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Kategorie
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:text-slate-900 dark:hover:text-white"
                      onClick={() => handleSort("position")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Position
                        {sortBy === "position" && (
                          <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:text-slate-900 dark:hover:text-white"
                      onClick={() => handleSort("delta")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Δ Letztes Update
                        {sortBy === "delta" && (
                          <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Δ Start
                    </th>
                    <th
                      className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:text-slate-900 dark:hover:text-white"
                      onClick={() => handleSort("volume")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Suchvolumen
                        {sortBy === "volume" && (
                          <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      URL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {paginatedKeywords.map((kw) => (
                    <tr
                      key={kw.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {kw.keyword}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {kw.category ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {kw.category}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {kw.currentPosition !== null ? (
                          <span
                            className={`text-sm font-bold ${
                              kw.currentPosition <= 3
                                ? "text-emerald-600 dark:text-emerald-400"
                                : kw.currentPosition <= 10
                                ? "text-blue-600 dark:text-blue-400"
                                : kw.currentPosition <= 20
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {kw.currentPosition}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {kw.deltaLast !== null ? (
                          <span
                            className={`text-sm font-medium ${
                              kw.deltaLast > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : kw.deltaLast < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-500"
                            }`}
                          >
                            {kw.deltaLast > 0 ? "+" : ""}
                            {kw.deltaLast}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {kw.deltaStart !== null ? (
                          <span
                            className={`text-sm font-medium ${
                              kw.deltaStart > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : kw.deltaStart < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-500"
                            }`}
                          >
                            {kw.deltaStart > 0 ? "+" : ""}
                            {kw.deltaStart}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {kw.searchVolume !== null ? (
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {kw.searchVolume.toLocaleString("de-DE")}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {kw.latestUrl ? (
                          <span
                            className="text-xs text-slate-500 dark:text-slate-400 truncate block max-w-[200px]"
                            title={kw.latestUrl}
                          >
                            {(() => {
                              try {
                                return new URL(kw.latestUrl).pathname;
                              } catch {
                                return kw.latestUrl;
                              }
                            })()}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginierung */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Seite {currentPage} von {totalPages} ({filteredKeywords.length} Keywords)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Zurück
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          currentPage === page
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Weiter
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
