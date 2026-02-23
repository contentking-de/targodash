"use client";

import { useState } from "react";
import Link from "next/link";

interface Keyword {
  text: string;
  cluster?: string;
}

interface Cluster {
  name: string;
  keywords: string[];
  color: string;
}

const clusterColors = [
  "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
  "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800",
];

export default function KeywordClusteringPage() {
  const [keywordsInput, setKeywordsInput] = useState("");
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const processKeywords = () => {
    if (!keywordsInput.trim()) return;

    setIsProcessing(true);

    // Parse keywords (one per line or comma-separated)
    const keywords = keywordsInput
      .split(/[\n,]/)
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0)
      .filter((k, i, arr) => arr.indexOf(k) === i); // Remove duplicates

    // Simple clustering based on common words
    setTimeout(() => {
      const clustered = clusterKeywords(keywords);
      setClusters(clustered);
      setIsProcessing(false);
    }, 500);
  };

  const clusterKeywords = (keywords: string[]): Cluster[] => {
    const clusters: Map<string, string[]> = new Map();
    const assigned = new Set<string>();

    // First pass: Group by common significant words
    for (const keyword of keywords) {
      const words = keyword.split(/\s+/).filter(w => w.length > 2);
      
      for (const word of words) {
        // Skip common stop words
        if (isStopWord(word)) continue;

        // Find other keywords containing this word
        const related = keywords.filter(k => 
          k !== keyword && 
          k.toLowerCase().includes(word) &&
          !assigned.has(k)
        );

        if (related.length > 0) {
          const clusterName = capitalizeFirst(word);
          const existing = clusters.get(clusterName) || [];
          
          if (!assigned.has(keyword)) {
            existing.push(keyword);
            assigned.add(keyword);
          }
          
          for (const r of related) {
            if (!assigned.has(r)) {
              existing.push(r);
              assigned.add(r);
            }
          }
          
          clusters.set(clusterName, existing);
        }
      }
    }

    // Second pass: Handle unassigned keywords
    const unassigned = keywords.filter(k => !assigned.has(k));
    if (unassigned.length > 0) {
      // Try to group unassigned by first significant word
      const otherClusters: Map<string, string[]> = new Map();
      
      for (const keyword of unassigned) {
        const words = keyword.split(/\s+/).filter(w => w.length > 2 && !isStopWord(w));
        const groupWord = words[0] || "Sonstige";
        const existing = otherClusters.get(groupWord) || [];
        existing.push(keyword);
        otherClusters.set(groupWord, existing);
      }

      // Merge small clusters into existing or create new
      for (const [name, kws] of otherClusters) {
        if (kws.length >= 2) {
          clusters.set(capitalizeFirst(name), kws);
        } else {
          const misc = clusters.get("Sonstige") || [];
          misc.push(...kws);
          clusters.set("Sonstige", misc);
        }
      }
    }

    // Convert to array and sort by size
    return Array.from(clusters.entries())
      .filter(([_, kws]) => kws.length > 0)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, kws], index) => ({
        name,
        keywords: kws.sort(),
        color: clusterColors[index % clusterColors.length],
      }));
  };

  const exportClusters = () => {
    let csv = "Cluster,Keyword\n";
    for (const cluster of clusters) {
      for (const keyword of cluster.keywords) {
        csv += `"${cluster.name}","${keyword}"\n`;
      }
    }
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keyword-clusters.csv";
    a.click();
  };

  const totalKeywords = clusters.reduce((sum, c) => sum + c.keywords.length, 0);

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
        <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Keyword Clustering</h1>
          <p className="text-slate-500 dark:text-slate-400">Gruppiere Keywords in thematische Cluster</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Keywords eingeben
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Ein Keyword pro Zeile oder kommagetrennt
              </p>
              <textarea
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder={`kredit vergleichen
kredit beantragen
kredit zinsen
kredit online
girokonto eröffnen
girokonto vergleich
tagesgeld zinsen
festgeld anlegen
kredit aufnehmen
privatkredit vergleich`}
                rows={12}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none font-mono text-sm"
              />
            </div>

            <button
              onClick={processKeywords}
              disabled={!keywordsInput.trim() || isProcessing}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Clustere Keywords...
                </span>
              ) : (
                "Keywords clustern"
              )}
            </button>
          </div>

          {/* Tips */}
          <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-200 dark:border-violet-800">
            <h3 className="font-medium text-violet-900 dark:text-violet-100 mb-2">Tipps</h3>
            <ul className="text-sm text-violet-800 dark:text-violet-200 space-y-1">
              <li>• Verwende mindestens 10 Keywords für bessere Ergebnisse</li>
              <li>• Keywords werden automatisch nach Themen gruppiert</li>
              <li>• Exportiere die Cluster als CSV für weitere Analysen</li>
            </ul>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {clusters.length > 0 ? (
            <>
              {/* Stats */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-900 dark:text-white">{totalKeywords}</span> Keywords in{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">{clusters.length}</span> Clustern
                </div>
                <button
                  onClick={exportClusters}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV Export
                </button>
              </div>

              {/* Clusters */}
              <div className="space-y-4">
                {clusters.map((cluster, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {cluster.name}
                      </h3>
                      <span className="text-sm text-slate-500">
                        {cluster.keywords.length} Keywords
                      </span>
                    </div>
                    <div className="p-4 flex flex-wrap gap-2">
                      {cluster.keywords.map((keyword, kidx) => (
                        <span
                          key={kidx}
                          className={`px-3 py-1.5 rounded-full text-sm border ${cluster.color}`}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 flex flex-col items-center justify-center text-center">
              <svg className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-slate-500">
                Gib Keywords ein und klicke auf "Keywords clustern"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function isStopWord(word: string): boolean {
  const stopWords = [
    "der", "die", "das", "und", "oder", "für", "mit", "von", "bei", "auf",
    "in", "an", "zu", "aus", "nach", "vor", "über", "unter", "durch", "als",
    "wie", "was", "wer", "wo", "wann", "warum", "ein", "eine", "einer", "einem",
    "einen", "ist", "sind", "war", "waren", "wird", "werden", "hat", "haben",
    "the", "and", "or", "for", "with", "from", "at", "on", "in", "to", "of"
  ];
  return stopWords.includes(word.toLowerCase());
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
