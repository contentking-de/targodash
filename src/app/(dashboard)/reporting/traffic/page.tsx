"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart, LineChart, PieChart } from "@/components/charts";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useProperty } from "@/contexts/PropertyContext";
import { sanitizeHtml } from "@/lib/sanitize";

const CATEGORY_FILTERS = [
  { label: "Konto & Karten", path: "/ch/de/services/accounts-and-cards/" },
  { label: "Kredit & Finanzierung", path: "/ch/de/services/mortgages-and-financing/" },
  { label: "Sparen & Investieren", path: "/ch/de/services/investments/" },
  { label: "Schutz & Vorsorge", path: "/ch/de/services/pension/" },
] as const;

interface TrendPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface KeywordData {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PageData {
  url: string;
  pathname: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface DeviceData {
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface DirectoryData {
  path: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pageCount: number;
}

interface Totals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface TrafficReportData {
  period: { startDate: string; endDate: string };
  previousPeriod: { startDate: string; endDate: string };
  current: Totals;
  previous: Totals;
  changes: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  dailyTrend: TrendPoint[];
  topKeywords: KeywordData[];
  topPages: PageData[];
  devices: DeviceData[];
  directories: DirectoryData[];
}

export default function TrafficReportPage() {
  const { selectedProperty } = useProperty();
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState("28d");
  const [urlFilter, setUrlFilter] = useState("");
  const [urlFilterInput, setUrlFilterInput] = useState("");
  const [data, setData] = useState<TrafficReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsGoogleConnection, setNeedsGoogleConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"keywords" | "pages" | "directories">("keywords");
  const [searchText, setSearchText] = useState("");
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [aiReportError, setAiReportError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // URL-Filter anwenden
  const applyUrlFilter = () => {
    setUrlFilter(urlFilterInput.trim());
  };

  const clearUrlFilter = () => {
    setUrlFilterInput("");
    setUrlFilter("");
  };

  // Daten laden
  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setNeedsGoogleConnection(false);

      try {
        const params = new URLSearchParams({
          siteUrl: selectedProperty,
          period,
        });
        if (urlFilter) params.set("urlFilter", urlFilter);

        const res = await fetch(
          `/api/reporting/traffic-report?${params}`
        );

        if (!res.ok) {
          const errorData = await res.json();
          if (errorData.needsConnection || res.status === 403) {
            setNeedsGoogleConnection(true);
            setIsLoading(false);
            return;
          }
          throw new Error(errorData.error || "Fehler beim Laden der Daten");
        }

        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching traffic report:", err);
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period, urlFilter]);

  // Chart-Daten
  const trendChartData = useMemo(() => {
    if (!data) return [];
    return data.dailyTrend.map((point) => ({
      date: new Date(point.date).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
      }),
      Klicks: point.clicks,
      Impressionen: point.impressions,
    }));
  }, [data]);

  const deviceChartData = useMemo(() => {
    if (!data) return [];
    return data.devices.map((d) => ({
      name: d.device === "DESKTOP" ? "Desktop" : d.device === "MOBILE" ? "Mobile" : d.device === "TABLET" ? "Tablet" : d.device,
      value: d.clicks,
    }));
  }, [data]);

  const directoryChartData = useMemo(() => {
    if (!data) return [];
    return data.directories.slice(0, 10).map((dir) => ({
      directory: dir.path.length > 25 ? "..." + dir.path.slice(-25) : dir.path,
      clicks: dir.clicks,
    }));
  }, [data]);

  // Gefilterte Tabellen-Daten
  const filteredTableData = useMemo(() => {
    if (!data) return [];
    const search = searchText.toLowerCase();

    if (activeTab === "keywords") {
      return data.topKeywords.filter((kw) =>
        kw.keyword.toLowerCase().includes(search)
      );
    }
    if (activeTab === "pages") {
      return data.topPages.filter(
        (p) =>
          p.pathname.toLowerCase().includes(search) ||
          p.url.toLowerCase().includes(search)
      );
    }
    if (activeTab === "directories") {
      return data.directories.filter((d) =>
        d.path.toLowerCase().includes(search)
      );
    }
    return [];
  }, [data, activeTab, searchText]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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
          type: "traffic",
          trafficData: {
            period: data.period,
            previousPeriod: data.previousPeriod,
            current: data.current,
            previous: data.previous,
            changes: data.changes,
            topKeywords: data.topKeywords.slice(0, 20),
            topPages: data.topPages.slice(0, 20),
            devices: data.devices,
            directories: data.directories.slice(0, 15),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fehler beim Generieren des Reports");
      }

      const result = await response.json();
      setAiReport(result.report);
    } catch (err) {
      console.error("Error generating AI report:", err);
      setAiReportError(err instanceof Error ? err.message : "Unbekannter Fehler");
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

  if (needsGoogleConnection) {
    return (
      <div className="space-y-6">
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Traffic Report</h1>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-red-500 dark:text-red-400 mb-4">
            Bitte verbinde zuerst dein Google-Konto, um Traffic-Daten abzurufen.
          </p>
          <a
            href="/settings"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Zu den Einstellungen
          </a>
        </div>
      </div>
    );
  }

  if (!selectedProperty) {
    return (
      <div className="space-y-6">
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Traffic Report</h1>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-500 dark:text-slate-400">
            Bitte wähle eine Property aus, um den Traffic Report anzuzeigen.
          </p>
        </div>
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Traffic Report</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organischer Traffic aus der Google Search Console
            {data && (
              <span>
                {" "}
                — {formatDate(data.period.startDate)} bis {formatDate(data.period.endDate)}
              </span>
            )}
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
        {/* Kategorie-Schnellfilter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">Kategorie:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setUrlFilterInput("");
                setUrlFilter("");
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                !urlFilter
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600"
              }`}
            >
              Alle
            </button>
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.label}
                onClick={() => {
                  setUrlFilterInput(cat.path);
                  setUrlFilter(cat.path);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  urlFilter === cat.path
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trennlinie */}
        <div className="border-t border-slate-200 dark:border-slate-700"></div>

        {/* Freier URL-Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">URL-Filter:</span>
          </div>
          <div className="flex-1 flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <input
                type="text"
                value={urlFilterInput}
                onChange={(e) => setUrlFilterInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyUrlFilter();
                }}
                placeholder="z.B. /de/hypotheken oder /en/invest — filtert alle GSC-Daten auf URLs die diesen Pfad enthalten"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <button
              onClick={applyUrlFilter}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
            >
              Anwenden
            </button>
            {urlFilter && (
              <button
                onClick={clearUrlFilter}
                className="px-3 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors shrink-0"
              >
                Zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Aktiver Filter Badge */}
        {urlFilter && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Aktiver Filter: URLs mit &quot;{urlFilter}&quot;
              {CATEGORY_FILTERS.find((c) => c.path === urlFilter) && (
                <span className="ml-1">({CATEGORY_FILTERS.find((c) => c.path === urlFilter)!.label})</span>
              )}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
          <p className="text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Hole Live-Daten aus der Google Search Console...
          </p>
        </div>
      ) : data ? (
        <>
          {/* KPIs mit Vergleich */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Klicks"
              value={data.current.clicks}
              change={data.changes.clicks}
              subtitle={`vs. ${data.previous.clicks.toLocaleString("de-DE")}`}
              trend={data.changes.clicks >= 0 ? "up" : "down"}
            />
            <StatCard
              title="Impressionen"
              value={data.current.impressions}
              change={data.changes.impressions}
              subtitle={`vs. ${data.previous.impressions.toLocaleString("de-DE")}`}
              trend={data.changes.impressions >= 0 ? "up" : "down"}
            />
            <StatCard
              title="CTR"
              value={data.current.ctr}
              format="percentage"
              change={data.changes.ctr}
              subtitle={`vs. ${(data.previous.ctr * 100).toFixed(2)}%`}
              trend={data.changes.ctr >= 0 ? "up" : "down"}
            />
            <StatCard
              title="Ø Position"
              value={data.current.position}
              format="position"
              change={data.changes.position}
              subtitle={`vs. ${data.previous.position.toFixed(1)}`}
              trend={data.changes.position <= 0 ? "up" : "down"}
            />
          </div>

          {/* Traffic Trend Chart */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Traffic-Verlauf
            </h3>
            {trendChartData.length > 0 ? (
              <LineChart
                data={trendChartData}
                xKey="date"
                lines={[
                  { key: "Klicks", name: "Klicks", color: "#3b82f6" },
                  { key: "Impressionen", name: "Impressionen", color: "#10b981" },
                ]}
                height={350}
              />
            ) : (
              <div className="h-[350px] flex items-center justify-center text-slate-500">
                Keine Daten verfügbar
              </div>
            )}
          </div>

          {/* Row 2: Devices & Directories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Geräte-Verteilung */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Geräte-Verteilung
              </h3>
              {deviceChartData.length > 0 ? (
                <div>
                  <PieChart data={deviceChartData} height={250} />
                  <div className="mt-4 space-y-2">
                    {data.devices.map((d) => (
                      <div key={d.device} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">
                          {d.device === "DESKTOP" ? "Desktop" : d.device === "MOBILE" ? "Mobile" : d.device === "TABLET" ? "Tablet" : d.device}
                        </span>
                        <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                          <span>{d.clicks.toLocaleString("de-DE")} Klicks</span>
                          <span>{(d.ctr * 100).toFixed(1)}% CTR</span>
                          <span>Pos. {d.position.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-slate-500">
                  Keine Daten verfügbar
                </div>
              )}
            </div>

            {/* Top Verzeichnisse */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Top Verzeichnisse nach Klicks
              </h3>
              {directoryChartData.length > 0 ? (
                <BarChart
                  data={directoryChartData}
                  xKey="directory"
                  yKey="clicks"
                  height={300}
                  horizontal
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  Keine Daten verfügbar
                </div>
              )}
            </div>
          </div>

          {/* KI-Report Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                  KI-generierter Traffic Report
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Generiere eine KI-Analyse des organischen Traffics mit Handlungsempfehlungen
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
                          <div key={i} className="ml-4 mb-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(`<span class="text-slate-400">&bull;</span> ${listText}`) }} />
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

          {/* Tabbed Data Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                  <button
                    onClick={() => { setActiveTab("keywords"); setSearchText(""); }}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      activeTab === "keywords"
                        ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Top Keywords ({data.topKeywords.length})
                  </button>
                  <button
                    onClick={() => { setActiveTab("pages"); setSearchText(""); }}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      activeTab === "pages"
                        ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Top Seiten ({data.topPages.length})
                  </button>
                  <button
                    onClick={() => { setActiveTab("directories"); setSearchText(""); }}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                      activeTab === "directories"
                        ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Verzeichnisse ({data.directories.length})
                  </button>
                </div>

                {/* Suche */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Suchen..."
                    className="w-full sm:w-64 px-4 py-2 pl-10 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      {activeTab === "keywords" ? "Keyword" : activeTab === "pages" ? "Seite" : "Verzeichnis"}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Klicks
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Impressionen
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      CTR
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Ø Position
                    </th>
                    {activeTab === "directories" && (
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Seiten
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {activeTab === "keywords" &&
                    (filteredTableData as KeywordData[]).map((kw, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{kw.keyword}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-blue-600 dark:text-blue-400">
                          {kw.clicks.toLocaleString("de-DE")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {kw.impressions.toLocaleString("de-DE")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {(kw.ctr * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {kw.position.toFixed(1)}
                        </td>
                      </tr>
                    ))}

                  {activeTab === "pages" &&
                    (filteredTableData as PageData[]).map((page, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-[350px]"
                            title={page.url}
                          >
                            {page.pathname}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-blue-600 dark:text-blue-400">
                          {page.clicks.toLocaleString("de-DE")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {page.impressions.toLocaleString("de-DE")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {(page.ctr * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {page.position.toFixed(1)}
                        </td>
                      </tr>
                    ))}

                  {activeTab === "directories" &&
                    (filteredTableData as DirectoryData[]).map((dir, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{dir.path}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-blue-600 dark:text-blue-400">
                          {dir.clicks.toLocaleString("de-DE")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {dir.impressions.toLocaleString("de-DE")}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {(dir.ctr * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {dir.position.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">
                          {dir.pageCount}
                        </td>
                      </tr>
                    ))}

                  {filteredTableData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        {searchText ? "Keine Ergebnisse für die Suche" : "Keine Daten verfügbar"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
