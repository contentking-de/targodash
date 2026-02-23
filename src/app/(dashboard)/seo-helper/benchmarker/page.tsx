"use client";

import { useState } from "react";
import Link from "next/link";

interface SerpResult {
  rank: number;
  title: string;
  url: string;
  domain: string;
  description: string;
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
  ownContent: {
    url: string;
    title: string;
    wordCount: number;
    headings: { level: string; text: string }[];
  };
  competitorContents: {
    url: string;
    title: string;
    wordCount: number;
    headings: { level: string; text: string }[];
  }[];
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

export default function BenchmarkerPage() {
  // Step 1: Keyword & SERP
  const [keyword, setKeyword] = useState("");
  const [serpResults, setSerpResults] = useState<SerpResult[]>([]);
  const [isLoadingSerp, setIsLoadingSerp] = useState(false);
  const [serpError, setSerpError] = useState("");

  // Step 2: Selection
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [ownUrl, setOwnUrl] = useState("");

  // Step 3: Analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");

  // Schritt 1: SERP-Ergebnisse laden
  const handleSearchSerp = async () => {
    if (!keyword.trim()) return;

    setIsLoadingSerp(true);
    setSerpError("");
    setSerpResults([]);
    setSelectedUrls(new Set());
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/seo-helper/benchmarker/serp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler bei der SERP-Abfrage");
      }

      setSerpResults(data.results);
    } catch (err) {
      setSerpError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsLoadingSerp(false);
    }
  };

  // URL-Auswahl toggeln
  const toggleUrlSelection = (url: string) => {
    const newSelection = new Set(selectedUrls);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      newSelection.add(url);
    }
    setSelectedUrls(newSelection);
  };

  // Alle auswählen / abwählen
  const toggleAllUrls = () => {
    if (selectedUrls.size === serpResults.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(serpResults.map(r => r.url)));
    }
  };

  // Schritt 3: Analyse starten
  const handleAnalyze = async () => {
    if (selectedUrls.size === 0 || !ownUrl.trim()) return;

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisResult(null);

    try {
      const response = await fetch("/api/seo-helper/benchmarker/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          ownUrl: ownUrl.trim(),
          competitorUrls: Array.from(selectedUrls),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler bei der Analyse");
      }

      setAnalysisResult(data);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
      case "medium":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
      case "low":
        return "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high": return "Hoch";
      case "medium": return "Mittel";
      case "low": return "Niedrig";
      default: return priority;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Content":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "Struktur":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        );
      case "SEO":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case "UX":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/seo-helper"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Benchmarker</h1>
          <p className="text-slate-500 dark:text-slate-400">Vergleiche deinen Content mit den Top-Konkurrenten</p>
        </div>
      </div>

      {/* Step 1: Keyword Input */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 font-semibold text-sm">
            1
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Keyword eingeben</h2>
        </div>
        
        <div className="flex gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSerp()}
            placeholder="z.B. Kredit vergleichen, Girokonto eröffnen..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={handleSearchSerp}
            disabled={!keyword.trim() || isLoadingSerp}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isLoadingSerp ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Suche...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                SERP laden
              </>
            )}
          </button>
        </div>

        {serpError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{serpError}</p>
          </div>
        )}

        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sucht die Top 10 Google-Ergebnisse für dein Keyword in Deutschland
        </p>
      </div>

      {/* Step 2: SERP Results & Selection */}
      {serpResults.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 font-semibold text-sm">
                2
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Konkurrenten auswählen</h2>
            </div>
            <button
              onClick={toggleAllUrls}
              className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
            >
              {selectedUrls.size === serpResults.length ? "Alle abwählen" : "Alle auswählen"}
            </button>
          </div>

          <div className="space-y-2">
            {serpResults.map((result) => (
              <label
                key={result.url}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedUrls.has(result.url)
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedUrls.has(result.url)}
                  onChange={() => toggleUrlSelection(result.url)}
                  className="mt-1 w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                      #{result.rank}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {result.domain}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-900 dark:text-white font-medium truncate">
                    {result.title}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {result.url}
                  </p>
                  {result.description && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {result.description}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {selectedUrls.size} von {serpResults.length} Konkurrenten ausgewählt
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Own URL & Analysis */}
      {selectedUrls.size > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 font-semibold text-sm">
              3
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Eigene URL eingeben & analysieren</h2>
          </div>

          <div className="flex gap-3">
            <input
              type="url"
              value={ownUrl}
              onChange={(e) => setOwnUrl(e.target.value)}
              placeholder="https://www.deine-seite.ch/deine-unterseite"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={handleAnalyze}
              disabled={!ownUrl.trim() || isAnalyzing}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analysiere...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Analyse starten
                </>
              )}
            </button>
          </div>

          {analysisError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{analysisError}</p>
            </div>
          )}

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Deine URL wird mit {selectedUrls.size} Konkurrenten verglichen
          </p>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {analysisResult.summary.ownWordCount.toLocaleString()}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Wörter (Deine Seite)</div>
              <div className={`text-xs mt-1 ${
                analysisResult.summary.ownWordCount >= analysisResult.summary.avgCompetitorWordCount 
                  ? "text-green-600" : "text-red-600"
              }`}>
                vs. Ø {analysisResult.summary.avgCompetitorWordCount.toLocaleString()} (Konkurrenz)
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {analysisResult.summary.ownHeadingsCount}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Überschriften</div>
              <div className={`text-xs mt-1 ${
                analysisResult.summary.ownHeadingsCount >= analysisResult.summary.avgCompetitorHeadingsCount 
                  ? "text-green-600" : "text-red-600"
              }`}>
                vs. Ø {analysisResult.summary.avgCompetitorHeadingsCount} (Konkurrenz)
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {analysisResult.contentGaps.length}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Content Gaps</div>
              <div className="text-xs mt-1 text-slate-400">
                Themen die fehlen
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analysisResult.recommendations.length}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Empfehlungen</div>
              <div className="text-xs mt-1 text-slate-400">
                Verbesserungsvorschläge
              </div>
            </div>
          </div>

          {/* Content Gaps */}
          {analysisResult.contentGaps.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Content Gaps</h2>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Diese Themen werden von deinen Konkurrenten behandelt, fehlen aber auf deiner Seite:
              </p>

              <div className="space-y-3">
                {analysisResult.contentGaps.map((gap, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-900 dark:text-white">
                            {gap.topic}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(gap.priority)}`}>
                            {getPriorityLabel(gap.priority)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {gap.description}
                        </p>
                        {gap.foundIn && gap.foundIn.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-slate-400">
                              Gefunden bei: {gap.foundIn.map(url => new URL(url).hostname).join(", ")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysisResult.recommendations.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Empfehlungen</h2>
              </div>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Konkrete Verbesserungsvorschläge basierend auf der Analyse:
              </p>

              <div className="space-y-3">
                {analysisResult.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {getCategoryIcon(rec.category)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                            {rec.category}
                          </span>
                          <h3 className="font-medium text-slate-900 dark:text-white">
                            {rec.title}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                            {getPriorityLabel(rec.priority)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                          {rec.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Competitor Details */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Analysierte Konkurrenten</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-slate-400">URL</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500 dark:text-slate-400">Wörter</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500 dark:text-slate-400">Überschriften</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-orange-50 dark:bg-orange-900/20">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-orange-500 text-white rounded">Du</span>
                        <span className="truncate max-w-xs" title={analysisResult.ownContent.url}>
                          {new URL(analysisResult.ownContent.url).hostname}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-3 font-medium text-slate-900 dark:text-white">
                      {analysisResult.ownContent.wordCount.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3 font-medium text-slate-900 dark:text-white">
                      {analysisResult.ownContent.headings.length}
                    </td>
                  </tr>
                  {analysisResult.competitorContents.map((comp, index) => (
                    <tr key={index} className="border-b border-slate-200 dark:border-slate-700">
                      <td className="py-2 px-3">
                        <span className="truncate max-w-xs block" title={comp.url}>
                          {new URL(comp.url).hostname}
                        </span>
                      </td>
                      <td className="text-right py-2 px-3 text-slate-600 dark:text-slate-400">
                        {comp.wordCount.toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-3 text-slate-600 dark:text-slate-400">
                        {comp.headings.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingSerp && serpResults.length === 0 && !serpError && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="inline-flex p-4 rounded-full bg-orange-100 dark:bg-orange-900/50 mb-4">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Content-Benchmark starten
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Gib ein Keyword ein, um die Top 10 Google-Ergebnisse in Deutschland zu laden. 
            Wähle dann Konkurrenten aus und vergleiche deinen Content mit deren Inhalten.
          </p>
        </div>
      )}

      {/* Info Note */}
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
        <h3 className="font-medium text-orange-900 dark:text-orange-100 mb-2">So funktioniert der Benchmarker</h3>
        <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
          <li>1. Gib ein Keyword ein und lade die Top 10 Suchergebnisse aus Deutschland</li>
          <li>2. Wähle die Konkurrenten aus, mit denen du dich vergleichen möchtest</li>
          <li>3. Gib deine eigene URL ein und starte die Analyse</li>
          <li>4. Erhalte Content-Gaps und konkrete Verbesserungsvorschläge</li>
        </ul>
      </div>
    </div>
  );
}
