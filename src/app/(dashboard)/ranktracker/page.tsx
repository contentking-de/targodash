"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { LineChart } from "@/components/charts/LineChart";
import { canEdit } from "@/lib/rbac";

interface RankingData {
  id: string;
  position: number | null;
  url: string | null;
  date: string;
}

interface KvpInfo {
  id: string;
  url: string;
  focusKeyword: string;
}

interface Keyword {
  id: string;
  keyword: string;
  category: string | null;
  targetUrl: string | null;
  createdAt: string;
  rankings: RankingData[];
  firstRanking?: RankingData | null;
  kvp?: KvpInfo | null;
  searchVolume?: number | null;
  searchVolumeUpdatedAt?: string | null;
}

const KEYWORD_CATEGORIES = [
  "Mortgages",
  "Accounts&Cards",
  "Investing",
  "Pension",
  "Digital Banking",
] as const;

interface Tracker {
  id: string;
  name: string;
  location: string;
  language: string;
  keywords: Keyword[];
}

interface Ranking {
  id: string;
  keywordId: string;
  position: number | null;
  url: string | null;
  date: string;
  keyword: {
    id: string;
    keyword: string;
    targetUrl: string | null;
  };
}

export default function RankTrackerPage() {
  const { data: session } = useSession();
  const canEditData = canEdit(session?.user?.role);
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [historicalRankings, setHistoricalRankings] = useState<Ranking[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [developmentFilter, setDevelopmentFilter] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [urlFilter, setUrlFilter] = useState<string>("");
  const [refreshingKeywordId, setRefreshingKeywordId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isFetchingVolume, setIsFetchingVolume] = useState(false);
  const itemsPerPage = 25;

  useEffect(() => {
    fetchTracker();
    fetchHistoricalRankings();
  }, []);

  async function fetchTracker() {
    try {
      const response = await fetch("/api/rank-tracker");
      const data = await response.json();
      setTracker(data.tracker);
    } catch (error) {
      console.error("Error fetching tracker:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchHistoricalRankings(keywordId?: string) {
    try {
      const url = keywordId
        ? `/api/rank-tracker/rankings?keywordId=${keywordId}&days=30`
        : `/api/rank-tracker/rankings?days=30`;
      const response = await fetch(url);
      const data = await response.json();
      setHistoricalRankings(data.rankings || []);
    } catch (error) {
      console.error("Error fetching historical rankings:", error);
    }
  }

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    try {
      const response = await fetch("/api/rank-tracker/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          category: newCategory || null,
          targetUrl: newTargetUrl.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Fehler beim Hinzufügen des Keywords");
        return;
      }

      setNewKeyword("");
      setNewCategory("");
      setNewTargetUrl("");
      setShowAddForm(false);
      await fetchTracker();
    } catch (error) {
      console.error("Error adding keyword:", error);
      alert("Fehler beim Hinzufügen des Keywords");
    }
  }

  async function handleDeleteKeyword(id: string) {
    if (!confirm("Möchtest Du dieses Keyword wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/rank-tracker/keywords/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        alert("Fehler beim Löschen des Keywords");
        return;
      }

      await fetchTracker();
      if (selectedKeyword === id) {
        setSelectedKeyword(null);
        fetchHistoricalRankings();
      } else {
        fetchHistoricalRankings(selectedKeyword || undefined);
      }
    } catch (error) {
      console.error("Error deleting keyword:", error);
      alert("Fehler beim Löschen des Keywords");
    }
  }

  async function handleFetchRankings() {
    setIsFetching(true);
    try {
      const response = await fetch("/api/rank-tracker/fetch", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Fehler beim Abrufen der Rankings");
        return;
      }

      const data = await response.json();
      alert(data.message || "Rankings erfolgreich abgerufen");
      await fetchTracker();
      await fetchHistoricalRankings(selectedKeyword || undefined);
    } catch (error) {
      console.error("Error fetching rankings:", error);
      alert("Fehler beim Abrufen der Rankings");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleRefreshKeyword(keywordId: string) {
    setRefreshingKeywordId(keywordId);
    try {
      const response = await fetch(`/api/rank-tracker/fetch?keywordId=${keywordId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Fehler beim Abrufen des Rankings");
        return;
      }

      await fetchTracker();
      await fetchHistoricalRankings(selectedKeyword || undefined);
    } catch (error) {
      console.error("Error refreshing keyword:", error);
      alert("Fehler beim Abrufen des Rankings");
    } finally {
      setRefreshingKeywordId(null);
    }
  }

  function handleKeywordSelect(keywordId: string) {
    if (selectedKeyword === keywordId) {
      setSelectedKeyword(null);
      fetchHistoricalRankings();
    } else {
      setSelectedKeyword(keywordId);
      fetchHistoricalRankings(keywordId);
    }
  }

  async function handleFetchSearchVolume() {
    setIsFetchingVolume(true);
    try {
      const response = await fetch("/api/rank-tracker/search-volume", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Fehler beim Abrufen des Suchvolumens");
        return;
      }

      const data = await response.json();
      alert(data.message || "Suchvolumen erfolgreich abgerufen");
      await fetchTracker();
    } catch (error) {
      console.error("Error fetching search volume:", error);
      alert("Fehler beim Abrufen des Suchvolumens");
    } finally {
      setIsFetchingVolume(false);
    }
  }

  // Hilfsfunktion für Delta-Berechnung
  const calculateDelta = (current: number | null, previous: number | null): number | null => {
    if (current === null || previous === null) return null;
    return previous - current; // Positiv = Verbesserung (niedrigere Position ist besser)
  };

  // Hilfsfunktion für Delta-Anzeige
  const renderDelta = (delta: number | null) => {
    if (delta === null) return <span className="text-slate-500">-</span>;
    if (delta === 0) return <span className="text-slate-500">±0</span>;
    if (delta > 0) {
      return (
        <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          +{delta}
        </span>
      );
    }
    return (
      <span className="text-red-600 dark:text-red-400 flex items-center gap-0.5">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        {delta}
      </span>
    );
  };

  // Bereite Daten für Tabelle vor (mit Kategorie- und Entwicklungs-Filter)
  const tableData = tracker?.keywords
    .map((keyword) => {
      const latestRanking = keyword.rankings[0];
      const previousRanking = keyword.rankings[1]; // Vorletztes Ranking
      const firstRanking = keyword.firstRanking;
      
      const currentPosition = latestRanking?.position ?? null;
      const previousPosition = previousRanking?.position ?? null;
      const firstPosition = firstRanking?.position ?? null;
      
      return {
        id: keyword.id,
        keyword: keyword.keyword,
        category: keyword.category,
        targetUrl: keyword.targetUrl || "targobank.de",
        position: currentPosition,
        deltaLast: calculateDelta(currentPosition, previousPosition),
        deltaFirst: calculateDelta(currentPosition, firstPosition),
        url: latestRanking?.url ?? null,
        lastUpdate: latestRanking?.date
          ? new Date(latestRanking.date).toLocaleDateString("de-DE")
          : "Nie",
        firstUpdate: firstRanking?.date
          ? new Date(firstRanking.date).toLocaleDateString("de-DE")
          : "Nie",
        kvp: keyword.kvp || null,
        searchVolume: keyword.searchVolume ?? null,
      };
    })
    .filter((row) => {
      // Suchtext-Filter (Keywords)
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        if (!row.keyword.toLowerCase().includes(searchLower)) return false;
      }
      
      // URL-Filter (Ranking URL enthält)
      if (urlFilter) {
        const urlLower = urlFilter.toLowerCase();
        if (!row.url?.toLowerCase().includes(urlLower)) return false;
      }
      
      // Kategorie-Filter
      if (categoryFilter) {
        if (categoryFilter === "__none__" && row.category) return false;
        if (categoryFilter !== "__none__" && row.category !== categoryFilter) return false;
      }
      
      // Entwicklungs-Filter
      if (developmentFilter) {
        switch (developmentFilter) {
          case "improved_last":
            return row.deltaLast !== null && row.deltaLast > 0;
          case "improved_start":
            return row.deltaFirst !== null && row.deltaFirst > 0;
          case "declined_last":
            return row.deltaLast !== null && row.deltaLast < 0;
          case "declined_start":
            return row.deltaFirst !== null && row.deltaFirst < 0;
          case "unchanged_last":
            return row.deltaLast === 0;
          case "unchanged_start":
            return row.deltaFirst === 0;
          default:
            return true;
        }
      }
      
      return true;
    }) || [];

  // Pagination berechnen
  const totalPages = Math.ceil(tableData.length / itemsPerPage);
  const paginatedData = tableData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset auf Seite 1 wenn Filter sich ändern
  const resetPagination = () => setCurrentPage(1);

  // Bereite Chart-Daten vor
  const chartData: Array<Record<string, unknown>> = [];
  if (selectedKeyword && historicalRankings.length > 0) {
    // Gruppiere nach Keyword
    const keywordRankings = historicalRankings.filter(
      (r) => r.keywordId === selectedKeyword
    );
    
    // Gruppiere nach Datum
    const byDate = new Map<string, number | null>();
    keywordRankings.forEach((r) => {
      const date = new Date(r.date).toLocaleDateString("de-DE");
      byDate.set(date, r.position);
    });

    // Sortiere nach Datum
    const sortedDates = Array.from(byDate.entries()).sort((a, b) => {
      return new Date(a[0].split(".").reverse().join("-")).getTime() -
        new Date(b[0].split(".").reverse().join("-")).getTime();
    });

    sortedDates.forEach(([date, position]) => {
      chartData.push({
        date,
        position: position ?? null,
      });
    });
  } else if (!selectedKeyword && historicalRankings.length > 0) {
    // Zeige alle Keywords zusammen
    const byDate = new Map<string, Array<{ keyword: string; position: number | null }>>();
    
    historicalRankings.forEach((r) => {
      const date = new Date(r.date).toLocaleDateString("de-DE");
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date)!.push({
        keyword: r.keyword.keyword,
        position: r.position,
      });
    });

    // Berechne Durchschnitt pro Datum
    const sortedDates = Array.from(byDate.entries()).sort((a, b) => {
      return new Date(a[0].split(".").reverse().join("-")).getTime() -
        new Date(b[0].split(".").reverse().join("-")).getTime();
    });

    sortedDates.forEach(([date, rankings]) => {
      const avgPosition =
        rankings.reduce((sum, r) => sum + (r.position ?? 100), 0) /
        rankings.length;
      chartData.push({
        date,
        position: avgPosition,
      });
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-8 bg-white dark:bg-slate-800 rounded animate-pulse w-48"></div>
        <div className="h-96 bg-white dark:bg-slate-800 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ranktracker</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Keyword-Suchfeld */}
          <div className="relative">
            <input
              type="text"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Keyword suchen..."
              className="pl-9 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400"
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
          {/* URL-Suchfeld */}
          <div className="relative">
            <input
              type="text"
              value={urlFilter}
              onChange={(e) => {
                setUrlFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="URL enthält..."
              className="pl-9 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
          {/* Kategorie-Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Kategorien</option>
            <option value="__none__">Ohne Kategorie</option>
            {KEYWORD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {/* Entwicklungs-Filter */}
          <select
            value={developmentFilter}
            onChange={(e) => {
              setDevelopmentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Entwicklungen</option>
            <optgroup label="Seit letzter Aktualisierung">
              <option value="improved_last">↑ Verbessert</option>
              <option value="declined_last">↓ Verschlechtert</option>
              <option value="unchanged_last">± Unverändert</option>
            </optgroup>
            <optgroup label="Seit Start">
              <option value="improved_start">↑ Verbessert seit Start</option>
              <option value="declined_start">↓ Verschlechtert seit Start</option>
              <option value="unchanged_start">± Unverändert seit Start</option>
            </optgroup>
          </select>
          {/* Filter zurücksetzen */}
          {(categoryFilter || developmentFilter || searchText || urlFilter) && (
            <button
              onClick={() => {
                setCategoryFilter("");
                setDevelopmentFilter("");
                setSearchText("");
                setUrlFilter("");
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded-lg text-sm transition-colors"
            >
              Filter zurücksetzen
            </button>
          )}
          {canEditData && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors"
            >
              {showAddForm ? "Abbrechen" : "Keyword hinzufügen"}
            </button>
          )}
          <button
            onClick={handleFetchRankings}
            disabled={!canEditData || isFetching || !tracker || tracker.keywords.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {isFetching ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Lädt...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rankings abrufen
              </>
            )}
          </button>
          <button
            onClick={handleFetchSearchVolume}
            disabled={!canEditData || isFetchingVolume || !tracker || tracker.keywords.length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {isFetchingVolume ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Lädt...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Suchvolumen abrufen
              </>
            )}
          </button>
        </div>
      </div>

      {showAddForm && canEditData && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Neues Keyword hinzufügen</h2>
          <form onSubmit={handleAddKeyword} className="space-y-4">
            <div>
              <label htmlFor="keyword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Keyword *
              </label>
              <input
                id="keyword"
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="z.B. seo tools"
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Kategorie (optional)
              </label>
              <select
                id="category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Keine Kategorie</option>
                {KEYWORD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="targetUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Ziel-URL (optional)
              </label>
              <input
                id="targetUrl"
                type="text"
                value={newTargetUrl}
                onChange={(e) => setNewTargetUrl(e.target.value)}
                placeholder="targobank.de (Standard)"
                className="w-full px-4 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Standardmäßig wird nach targobank.de URLs gesucht. Du kannst eine andere Domain angeben.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Hinzufügen
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewKeyword("");
                  setNewCategory("");
                  setNewTargetUrl("");
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {tracker && tracker.keywords.length > 0 ? (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Keywords & Rankings
                <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                  ({tracker.keywords.length})
                </span>
              </h2>
              {(categoryFilter || developmentFilter || searchText || urlFilter) && (
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {tableData.length} von {tracker.keywords.length} gefiltert
                </span>
              )}
            </div>
            <DataTable
              data={paginatedData}
              columns={[
                {
                  key: "keyword",
                  header: "Keyword",
                  sortable: true,
                },
                {
                  key: "category",
                  header: "Kategorie",
                  sortable: true,
                  render: (value) => {
                    if (!value) {
                      return <span className="text-slate-500 dark:text-slate-500">-</span>;
                    }
                    return <span className="text-slate-700 dark:text-slate-300">{value as string}</span>;
                  },
                },
                {
                  key: "searchVolume",
                  header: "Suchvolumen",
                  sortable: true,
                  render: (value) => {
                    if (value === null || value === undefined) {
                      return <span className="text-slate-500 dark:text-slate-500">-</span>;
                    }
                    // Formatiere das Suchvolumen mit Tausender-Trennzeichen
                    const formattedVolume = (value as number).toLocaleString("de-DE");
                    return (
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {formattedVolume}
                      </span>
                    );
                  },
                },
                {
                  key: "position",
                  header: "Position",
                  sortable: true,
                  render: (value, row) => {
                    if (value === null) {
                      // Zeige ">100" wenn es ein Aktualisierungsdatum gibt, sonst "-"
                      if (row.lastUpdate && row.lastUpdate !== "Nie") {
                        return <span className="text-slate-500 dark:text-slate-500">&gt;100</span>;
                      }
                      return <span className="text-slate-500 dark:text-slate-500">-</span>;
                    }
                    const pos = value as number;
                    let color = "text-red-600 dark:text-red-400";
                    if (pos <= 3) color = "text-green-600 dark:text-green-400";
                    else if (pos <= 10) color = "text-yellow-600 dark:text-yellow-400";
                    return <span className={`font-semibold ${color}`}>{pos}</span>;
                  },
                },
                {
                  key: "deltaLast",
                  header: "Δ Letzte",
                  sortable: true,
                  render: (value) => renderDelta(value as number | null),
                },
                {
                  key: "deltaFirst",
                  header: "Δ Start",
                  sortable: true,
                  render: (value) => renderDelta(value as number | null),
                },
                {
                  key: "url",
                  header: "Ranking URL",
                  render: (value) => {
                    if (!value) return <span className="text-slate-500 dark:text-slate-500">-</span>;
                    return (
                      <a
                        href={value as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate max-w-xs block"
                      >
                        {value as string}
                      </a>
                    );
                  },
                },
                {
                  key: "lastUpdate",
                  header: "Aktualisiert",
                  sortable: true,
                },
                {
                  key: "kvp",
                  header: "KVP",
                  render: (value) => {
                    const kvp = value as KvpInfo | null;
                    if (!kvp) {
                      return <span className="text-slate-500 dark:text-slate-500">-</span>;
                    }
                    return (
                      <a
                        href={`/kvp?search=${encodeURIComponent(kvp.focusKeyword)}`}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded text-xs transition-colors"
                        title={`KVP: ${kvp.focusKeyword}`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Ja
                      </a>
                    );
                  },
                },
                {
                  key: "actions",
                  header: "Aktionen",
                  render: (_, row) => (
                    <div className="flex gap-2 items-center">
                      {canEditData && (
                        <>
                          <button
                            onClick={() => handleRefreshKeyword(row.id as string)}
                            disabled={refreshingKeywordId === row.id}
                            className="p-1.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Ranking aktualisieren"
                          >
                            <svg
                              className={`w-4 h-4 ${refreshingKeywordId === row.id ? "animate-spin" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteKeyword(row.id as string)}
                            className="p-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                            title="Löschen"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
              keyField="id"
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Zeige {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, tableData.length)} von {tableData.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded transition-colors"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded transition-colors"
                  >
                    «
                  </button>
                  
                  {/* Seitenzahlen */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        // Zeige erste, letzte, aktuelle und benachbarte Seiten
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((page, index, arr) => {
                        // Füge "..." zwischen nicht aufeinanderfolgenden Seiten ein
                        const prevPage = arr[index - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;
                        
                        return (
                          <span key={page} className="flex items-center gap-1">
                            {showEllipsis && (
                              <span className="px-2 text-slate-500 dark:text-slate-400">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 text-sm rounded transition-colors ${
                                currentPage === page
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {page}
                            </button>
                          </span>
                        );
                      })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded transition-colors"
                  >
                    »
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 rounded transition-colors"
                  >
                    »»
                  </button>
                </div>
              </div>
            )}
          </div>

          {chartData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Ranking-Verlauf {selectedKeyword ? `(${tracker.keywords.find(k => k.id === selectedKeyword)?.keyword})` : "(Durchschnitt)"}
              </h2>
              <LineChart
                data={chartData}
                xKey="date"
                lines={[
                  { key: "position", name: "Position", color: "#3b82f6" },
                ]}
                height={300}
              />
            </div>
          )}

          {/* Ranking-Änderungen Übersicht */}
          {(() => {
            // Berechne Statistiken aus den ungefilterten Daten (alle Keywords)
            const allKeywordsData = tracker?.keywords.map((keyword) => {
              const latestRanking = keyword.rankings[0];
              const previousRanking = keyword.rankings[1];
              const currentPosition = latestRanking?.position ?? null;
              const previousPosition = previousRanking?.position ?? null;
              if (currentPosition === null || previousPosition === null) return null;
              return previousPosition - currentPosition; // Positiv = Verbesserung
            }) || [];

            const improved = allKeywordsData.filter((delta) => delta !== null && delta > 0).length;
            const declined = allKeywordsData.filter((delta) => delta !== null && delta < 0).length;
            const unchanged = allKeywordsData.filter((delta) => delta === 0).length;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                  title="Gestiegen"
                  value={improved}
                  subtitle="seit letzter Aktualisierung"
                  trend="up"
                  icon={
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  }
                />
                <StatCard
                  title="Gefallen"
                  value={declined}
                  subtitle="seit letzter Aktualisierung"
                  trend="down"
                  icon={
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  }
                />
                <StatCard
                  title="Keine Änderung"
                  value={unchanged}
                  subtitle="seit letzter Aktualisierung"
                  icon={
                    <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  }
                />
              </div>
            );
          })()}
        </>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 border border-slate-200 dark:border-slate-700 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Noch keine Keywords</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {canEditData 
              ? "Füge Dein erstes Keyword hinzu, um Rankings zu tracken."
              : "Es sind noch keine Keywords vorhanden."}
          </p>
          {canEditData && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Erstes Keyword hinzufügen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
