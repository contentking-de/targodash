"use client";

import { useState, useEffect, useCallback } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { PieChart } from "@/components/charts/PieChart";

interface BacklinksSummary {
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

interface Backlink {
  type: string;
  domain_from: string;
  url_from: string;
  url_to: string;
  tld_from: string;
  rank: number;
  page_from_rank: number;
  domain_from_rank: number;
  domain_from_country: string | null;
  page_from_title: string | null;
  first_seen: string;
  last_seen: string;
  item_type: string;
  dofollow: boolean;
  anchor: string | null;
  is_new: boolean;
  is_lost: boolean;
  backlink_spam_score: number;
}

interface ReferringDomain {
  type: string;
  domain: string;
  rank: number;
  backlinks: number;
  first_seen: string;
  backlinks_spam_score: number;
}

type TabType = "overview" | "backlinks" | "domains";
type FilterType = "all" | "dofollow" | "nofollow" | "new" | "lost";

export default function LinkprofilPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [summary, setSummary] = useState<BacklinksSummary | null>(null);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [domains, setDomains] = useState<ReferringDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  
  // Pagination & Filter
  const [backlinksPage, setBacklinksPage] = useState(0);
  const [domainsPage, setDomainsPage] = useState(0);
  const [backlinksTotal, setBacklinksTotal] = useState(0);
  const [domainsTotal, setDomainsTotal] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");
  const pageSize = 50;

  // Summary laden (aus Datenbank)
  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch("/api/backlinks?type=summary");
      if (!response.ok) throw new Error("Fehler beim Laden der Summary");
      const data = await response.json();
      setSummary(data.summary);
      setLastUpdated(data.lastUpdated || null);
      setNeedsRefresh(data.needsRefresh || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, []);

  // Daten von DataForSEO aktualisieren (POST)
  const refreshFromAPI = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/backlinks", {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Aktualisieren");
      }
      const data = await response.json();
      alert(data.message || "Linkprofil erfolgreich aktualisiert!");
      
      // Daten neu laden
      setNeedsRefresh(false);
      await fetchSummary();
      // Reset der geladenen Daten, damit sie neu geladen werden
      setBacklinks([]);
      setDomains([]);
      setBacklinksPage(0);
      setDomainsPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchSummary]);

  // Backlinks laden
  const fetchBacklinks = useCallback(async (page: number, currentFilter: FilterType) => {
    setIsLoadingBacklinks(true);
    try {
      let url = `/api/backlinks?type=backlinks&limit=${pageSize}&offset=${page * pageSize}`;
      
      if (currentFilter === "dofollow") url += "&dofollow=true";
      else if (currentFilter === "nofollow") url += "&dofollow=false";
      else if (currentFilter === "new") url += "&isNew=true";
      else if (currentFilter === "lost") url += "&isLost=true";

      const response = await fetch(url);
      if (!response.ok) throw new Error("Fehler beim Laden der Backlinks");
      const data = await response.json();
      setBacklinks(data.backlinks || []);
      setBacklinksTotal(data.total_count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsLoadingBacklinks(false);
    }
  }, []);

  // Referring Domains laden
  const fetchDomains = useCallback(async (page: number) => {
    setIsLoadingDomains(true);
    try {
      const response = await fetch(`/api/backlinks?type=domains&limit=${pageSize}&offset=${page * pageSize}`);
      if (!response.ok) throw new Error("Fehler beim Laden der Referring Domains");
      const data = await response.json();
      setDomains(data.domains || []);
      setDomainsTotal(data.total_count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsLoadingDomains(false);
    }
  }, []);

  // Initial-Laden
  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      await fetchSummary();
      setIsLoading(false);
    }
    loadInitialData();
  }, [fetchSummary]);

  // Tab-Wechsel
  useEffect(() => {
    if (activeTab === "backlinks" && backlinks.length === 0) {
      fetchBacklinks(0, filter);
    } else if (activeTab === "domains" && domains.length === 0) {
      fetchDomains(0);
    }
  }, [activeTab, backlinks.length, domains.length, filter, fetchBacklinks, fetchDomains]);

  // Filter-Änderung
  useEffect(() => {
    if (activeTab === "backlinks") {
      setBacklinksPage(0);
      fetchBacklinks(0, filter);
    }
  }, [filter, activeTab, fetchBacklinks]);

  // Formatierung
  const formatNumber = (num: number) => num.toLocaleString("de-DE");
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-DE");
  };

  // Spam-Score Farbe
  const getSpamScoreColor = (score: number) => {
    if (score <= 30) return "text-green-600 dark:text-green-400";
    if (score <= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  // Rank Farbe
  const getRankColor = (rank: number) => {
    if (rank >= 70) return "text-green-600 dark:text-green-400";
    if (rank >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-8 bg-white dark:bg-slate-800 rounded animate-pulse w-48"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white dark:bg-slate-800 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Fehler</h3>
        <p className="text-red-600 dark:text-red-300">{error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchSummary();
          }}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  // Pie Chart Daten
  const pieData = summary ? [
    { name: "Dofollow", value: summary.dofollow, color: "#22c55e" },
    { name: "Nofollow", value: summary.nofollow, color: "#ef4444" },
  ] : [];

  // Formatiere das lastUpdated-Datum
  const formatLastUpdated = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Wenn noch keine Daten vorhanden sind, zeige Hinweis
  if (needsRefresh && !summary) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Linkprofil</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Backlink-Analyse für <span className="font-semibold text-blue-600 dark:text-blue-400">targobank.de</span>
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Noch keine Daten vorhanden</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Klicke auf &quot;Daten abrufen&quot;, um das Linkprofil von targobank.de zu laden.<br />
            <span className="text-sm text-slate-500">Hinweis: Dies verbraucht API-Credits bei DataForSEO.</span>
          </p>
          <button
            onClick={refreshFromAPI}
            disabled={isRefreshing}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors inline-flex items-center gap-2"
          >
            {isRefreshing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Lade Daten...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Daten abrufen
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Linkprofil</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Backlink-Analyse für <span className="font-semibold text-blue-600 dark:text-blue-400">targobank.de</span>
            {lastUpdated && (
              <span className="ml-2 text-sm text-slate-500">
                • Stand: {formatLastUpdated(lastUpdated)}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refreshFromAPI}
          disabled={isRefreshing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {isRefreshing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Aktualisiere...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Aktualisieren
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-4">
          {[
            { id: "overview", label: "Übersicht", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { id: "backlinks", label: "Backlinks", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
            { id: "domains", label: "Referring Domains", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Übersicht Tab */}
      {activeTab === "overview" && summary && (
        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Gesamt Backlinks"
              value={formatNumber(summary.total_backlinks)}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              }
              subtitle={summary.new_backlinks > 0 ? `+${formatNumber(summary.new_backlinks)} neue Links` : undefined}
              trend={summary.new_backlinks > 0 ? "up" : undefined}
            />
            <StatCard
              title="Referring Domains"
              value={formatNumber(summary.total_referring_domains)}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              }
            />
            <StatCard
              title="Dofollow Links"
              value={formatNumber(summary.dofollow)}
              icon={
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
              subtitle={`${((summary.dofollow / summary.total_backlinks) * 100).toFixed(1)}% aller Links`}
            />
            <StatCard
              title="Nofollow Links"
              value={formatNumber(summary.nofollow)}
              icon={
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              }
              subtitle={`${((summary.nofollow / summary.total_backlinks) * 100).toFixed(1)}% aller Links`}
            />
          </div>

          {/* Weitere Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">Dofollow vs. Nofollow</h3>
              <div className="h-64">
                <PieChart data={pieData} />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">Netzwerk-Metriken</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 dark:text-slate-300">Main Domains</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatNumber(summary.total_referring_main_domains)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 dark:text-slate-300">Referring IPs</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatNumber(summary.total_referring_ips)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 dark:text-slate-300">Referring Subnets</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatNumber(summary.total_referring_subnets)}</span>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">Link-Dynamik</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Neue Backlinks
                  </span>
                  <span className="font-semibold text-green-600 dark:text-green-400">+{formatNumber(summary.new_backlinks)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Verlorene Backlinks
                  </span>
                  <span className="font-semibold text-red-600 dark:text-red-400">-{formatNumber(summary.lost_backlinks)}</span>
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 dark:text-slate-300">Netto-Veränderung</span>
                    <span className={`font-semibold ${summary.new_backlinks - summary.lost_backlinks >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {summary.new_backlinks - summary.lost_backlinks >= 0 ? "+" : ""}{formatNumber(summary.new_backlinks - summary.lost_backlinks)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backlinks Tab */}
      {activeTab === "backlinks" && (
        <div className="space-y-6">
          {/* Filter */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "Alle", count: backlinksTotal },
              { id: "dofollow", label: "Dofollow" },
              { id: "nofollow", label: "Nofollow" },
              { id: "new", label: "Neue" },
              { id: "lost", label: "Verloren" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as FilterType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {f.label}
                {f.count !== undefined && (
                  <span className="ml-2 text-xs opacity-75">({formatNumber(f.count)})</span>
                )}
              </button>
            ))}
          </div>

          {/* Tabelle */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {isLoadingBacklinks ? (
              <div className="p-12 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-4 text-slate-600 dark:text-slate-400">Lade Backlinks...</p>
              </div>
            ) : (
              <>
                <DataTable
                  data={backlinks.map((bl, idx) => ({ ...bl, _uniqueId: `${bl.url_from}-${bl.url_to}-${idx}` }))}
                  columns={[
                    {
                      key: "domain_from",
                      header: "Quell-Domain",
                      sortable: true,
                      render: (value, row) => (
                        <div>
                          <a
                            href={row.url_from}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            {value as string}
                          </a>
                          {row.domain_from_country && (
                            <span className="ml-2 text-xs text-slate-500 dark:text-slate-500">
                              {row.domain_from_country}
                            </span>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: "anchor",
                      header: "Anchor-Text",
                      render: (value) => (
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-xs block">
                          {(value as string) || <span className="text-slate-500 italic">kein Anchor</span>}
                        </span>
                      ),
                    },
                    {
                      key: "url_to",
                      header: "Ziel-URL",
                      render: (value) => (
                        <a
                          href={value as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-xs block text-sm"
                        >
                          {(value as string).replace("https://", "").replace("http://", "")}
                        </a>
                      ),
                    },
                    {
                      key: "domain_from_rank",
                      header: "Domain Rank",
                      sortable: true,
                      render: (value) => (
                        <span className={`font-semibold ${getRankColor(value as number)}`}>
                          {value as number}
                        </span>
                      ),
                    },
                    {
                      key: "dofollow",
                      header: "Typ",
                      render: (value) => (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          value
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        }`}>
                          {value ? "dofollow" : "nofollow"}
                        </span>
                      ),
                    },
                    {
                      key: "backlink_spam_score",
                      header: "Spam Score",
                      sortable: true,
                      render: (value) => (
                        <span className={`font-medium ${getSpamScoreColor(value as number)}`}>
                          {value as number}%
                        </span>
                      ),
                    },
                    {
                      key: "first_seen",
                      header: "Entdeckt",
                      sortable: true,
                      render: (value) => (
                        <span className="text-slate-600 dark:text-slate-400 text-sm">
                          {formatDate(value as string)}
                        </span>
                      ),
                    },
                  ]}
                  keyField="_uniqueId"
                />

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Zeige {backlinksPage * pageSize + 1} - {Math.min((backlinksPage + 1) * pageSize, backlinksTotal)} von {formatNumber(backlinksTotal)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newPage = backlinksPage - 1;
                        setBacklinksPage(newPage);
                        fetchBacklinks(newPage, filter);
                      }}
                      disabled={backlinksPage === 0}
                      className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded transition-colors"
                    >
                      Zurück
                    </button>
                    <button
                      onClick={() => {
                        const newPage = backlinksPage + 1;
                        setBacklinksPage(newPage);
                        fetchBacklinks(newPage, filter);
                      }}
                      disabled={(backlinksPage + 1) * pageSize >= backlinksTotal}
                      className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded transition-colors"
                    >
                      Weiter
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Referring Domains Tab */}
      {activeTab === "domains" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {isLoadingDomains ? (
              <div className="p-12 text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-4 text-slate-600 dark:text-slate-400">Lade Referring Domains...</p>
              </div>
            ) : (
              <>
                <DataTable
                  data={domains.map((d, idx) => ({ ...d, _uniqueId: `${d.domain}-${idx}` }))}
                  columns={[
                    {
                      key: "domain",
                      header: "Domain",
                      sortable: true,
                      render: (value) => (
                        <a
                          href={`https://${value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {value as string}
                        </a>
                      ),
                    },
                    {
                      key: "rank",
                      header: "Domain Rank",
                      sortable: true,
                      render: (value) => (
                        <span className={`font-semibold ${getRankColor(value as number)}`}>
                          {value as number}
                        </span>
                      ),
                    },
                    {
                      key: "backlinks",
                      header: "Backlinks",
                      sortable: true,
                      render: (value) => (
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatNumber(value as number)}
                        </span>
                      ),
                    },
                    {
                      key: "backlinks_spam_score",
                      header: "Spam Score",
                      sortable: true,
                      render: (value) => (
                        <span className={`font-medium ${getSpamScoreColor(value as number)}`}>
                          {value as number}%
                        </span>
                      ),
                    },
                    {
                      key: "first_seen",
                      header: "Entdeckt",
                      sortable: true,
                      render: (value) => (
                        <span className="text-slate-600 dark:text-slate-400 text-sm">
                          {formatDate(value as string)}
                        </span>
                      ),
                    },
                  ]}
                  keyField="_uniqueId"
                />

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Zeige {domainsPage * pageSize + 1} - {Math.min((domainsPage + 1) * pageSize, domainsTotal)} von {formatNumber(domainsTotal)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newPage = domainsPage - 1;
                        setDomainsPage(newPage);
                        fetchDomains(newPage);
                      }}
                      disabled={domainsPage === 0}
                      className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded transition-colors"
                    >
                      Zurück
                    </button>
                    <button
                      onClick={() => {
                        const newPage = domainsPage + 1;
                        setDomainsPage(newPage);
                        fetchDomains(newPage);
                      }}
                      disabled={(domainsPage + 1) * pageSize >= domainsTotal}
                      className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded transition-colors"
                    >
                      Weiter
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
