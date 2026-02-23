"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface AnalysisResult {
  wordCount: number;
  charCount: number;
  sentenceCount: number;
  paragraphCount: number;
  avgWordsPerSentence: number;
  readingTime: number;
  keywordDensity: number;
  keywordCount: number;
  headings: { level: string; text: string }[];
  readabilityScore: number;
  readabilityLabel: string;
}

interface UrlFetchResult {
  content: string;
  title: string;
  metaDescription: string;
  headings: { level: string; text: string }[];
  url: string;
}

export default function ContentAnalyzerPage() {
  const [content, setContent] = useState("");
  const [keyword, setKeyword] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // URL Import State
  const [url, setUrl] = useState("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [urlMetadata, setUrlMetadata] = useState<UrlFetchResult | null>(null);
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [taskCopySuccess, setTaskCopySuccess] = useState(false);

  const handleUrlFetch = async () => {
    if (!url.trim()) return;

    setIsLoadingUrl(true);
    setUrlError("");
    setUrlMetadata(null);

    try {
      const response = await fetch("/api/seo-helper/fetch-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Laden");
      }

      setContent(data.content);
      setUrlMetadata(data);
      setShowAnalysis(true);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const analysis = useMemo((): AnalysisResult | null => {
    if (!content.trim()) return null;

    const text = content.trim();
    
    // Basic counts
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const charCount = text.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length || 1;
    const avgWordsPerSentence = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed

    // Keyword analysis
    let keywordCount = 0;
    let keywordDensity = 0;
    if (keyword.trim()) {
      const keywordLower = keyword.toLowerCase();
      const textLower = text.toLowerCase();
      const regex = new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = textLower.match(regex);
      keywordCount = matches ? matches.length : 0;
      keywordDensity = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;
    }

    // Extract headings (if markdown-style)
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: { level: string; text: string }[] = [];
    let match;
    while ((match = headingRegex.exec(text)) !== null) {
      headings.push({ level: `H${match[1].length}`, text: match[2] });
    }

    // Readability Score (Flesch-Kincaid simplified for German)
    const syllableCount = words.reduce((count, word) => {
      return count + countSyllables(word);
    }, 0);
    const avgSyllablesPerWord = wordCount > 0 ? syllableCount / wordCount : 0;
    
    // Flesch Reading Ease adapted
    const readabilityScore = Math.round(
      180 - avgWordsPerSentence - (58.5 * avgSyllablesPerWord)
    );
    
    let readabilityLabel = "";
    if (readabilityScore >= 60) readabilityLabel = "Sehr leicht";
    else if (readabilityScore >= 50) readabilityLabel = "Leicht";
    else if (readabilityScore >= 40) readabilityLabel = "Mittel";
    else if (readabilityScore >= 30) readabilityLabel = "Schwierig";
    else readabilityLabel = "Sehr schwierig";

    return {
      wordCount,
      charCount,
      sentenceCount,
      paragraphCount,
      avgWordsPerSentence,
      readingTime,
      keywordDensity,
      keywordCount,
      headings,
      readabilityScore: Math.max(0, Math.min(100, readabilityScore)),
      readabilityLabel,
    };
  }, [content, keyword]);

  const handleAnalyze = () => {
    setShowAnalysis(true);
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
        <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Content Analyzer</h1>
          <p className="text-slate-500 dark:text-slate-400">Analysiere deinen Content auf SEO-Faktoren</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            {/* Input Mode Toggle */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
              <button
                onClick={() => setInputMode("text")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  inputMode === "text"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Text eingeben
                </span>
              </button>
              <button
                onClick={() => setInputMode("url")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  inputMode === "url"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Von URL laden
                </span>
              </button>
            </div>

            {/* URL Input Mode */}
            {inputMode === "url" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Website URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        setUrlError("");
                      }}
                      placeholder="https://www.beispiel.ch/seite"
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      onKeyDown={(e) => e.key === "Enter" && keyword.trim() && handleUrlFetch()}
                    />
                    <button
                      onClick={handleUrlFetch}
                      disabled={!url.trim() || !keyword.trim() || isLoadingUrl}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      {isLoadingUrl ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Laden...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Laden
                        </>
                      )}
                    </button>
                  </div>
                  {urlError && (
                    <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {urlError}
                    </p>
                  )}
                </div>

                {/* URL Metadata Display */}
                {urlMetadata && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                          Content erfolgreich geladen
                        </p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 truncate">
                          {urlMetadata.url}
                        </p>
                      </div>
                    </div>
                    {urlMetadata.title && (
                      <div>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Title:</span>
                        <p className="text-sm text-emerald-900 dark:text-emerald-100">{urlMetadata.title}</p>
                      </div>
                    )}
                    {urlMetadata.metaDescription && (
                      <div>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Meta-Description:</span>
                        <p className="text-sm text-emerald-900 dark:text-emerald-100">{urlMetadata.metaDescription}</p>
                      </div>
                    )}
                    {urlMetadata.headings.length > 0 && (
                      <div>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          {urlMetadata.headings.length} Überschriften gefunden
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Ziel-Keyword {inputMode === "url" ? <span className="text-red-500">*</span> : "(optional)"}
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="z.B. Kredit vergleichen"
                className={`w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  inputMode === "url" && !keyword.trim() 
                    ? "border-amber-300 dark:border-amber-600" 
                    : "border-slate-200 dark:border-slate-600"
                }`}
              />
              {inputMode === "url" && !keyword.trim() && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Bitte gib ein Keyword ein, um die URL zu laden
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Content {inputMode === "url" && urlMetadata && "(von URL geladen)"}
                </label>
                <span className="text-xs text-slate-500">
                  {content.split(/\s+/).filter(w => w.length > 0).length} Wörter
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={inputMode === "url" ? "Content wird hier nach dem Laden angezeigt..." : "Füge deinen Text hier ein..."}
                rows={15}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono text-sm"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!content.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Analysieren
            </button>
          </div>

          {/* Improvement Suggestions - shown below content input */}
          {showAnalysis && analysis && (() => {
            const improvements: { issue: string; suggestion: string }[] = [];
            
            // Content improvements
            if (analysis.wordCount < 300) {
              improvements.push({
                issue: "Zu wenig Content",
                suggestion: `Erhöhe die Wortanzahl von ${analysis.wordCount} auf mindestens 300 Wörter`
              });
            } else if (analysis.wordCount < 1000) {
              improvements.push({
                issue: "Content könnte umfangreicher sein",
                suggestion: `Erweitere den Content von ${analysis.wordCount} auf mindestens 1000 Wörter für bessere Rankings`
              });
            }
            
            if (analysis.avgWordsPerSentence > 20) {
              improvements.push({
                issue: "Sätze zu lang",
                suggestion: `Kürze die Sätze von durchschnittlich ${analysis.avgWordsPerSentence} auf max. 20 Wörter pro Satz`
              });
            }
            
            if (analysis.paragraphCount < 3) {
              improvements.push({
                issue: "Zu wenige Absätze",
                suggestion: "Strukturiere den Text in mindestens 3 Absätze für bessere Lesbarkeit"
              });
            }
            
            if (analysis.readabilityScore < 30) {
              improvements.push({
                issue: "Schwere Lesbarkeit",
                suggestion: "Vereinfache die Sprache und verwende kürzere Sätze und einfachere Wörter"
              });
            }
            
            // Keyword improvements
            if (keyword) {
              if (analysis.keywordCount === 0) {
                improvements.push({
                  issue: "Keyword fehlt",
                  suggestion: `Füge das Keyword "${keyword}" natürlich in den Text ein`
                });
              } else if (analysis.keywordDensity < 1) {
                improvements.push({
                  issue: "Keyword-Dichte zu niedrig",
                  suggestion: `Erhöhe die Keyword-Dichte von ${analysis.keywordDensity.toFixed(2)}% auf 1-2.5%`
                });
              } else if (analysis.keywordDensity > 2.5) {
                improvements.push({
                  issue: "Keyword-Stuffing",
                  suggestion: `Reduziere die Keyword-Dichte von ${analysis.keywordDensity.toFixed(2)}% auf 1-2.5%`
                });
              }
            }
            
            // URL-based improvements
            if (urlMetadata) {
              if (!urlMetadata.title) {
                improvements.push({
                  issue: "Title-Tag fehlt",
                  suggestion: "Füge einen aussagekräftigen Title-Tag hinzu (50-60 Zeichen)"
                });
              }
              if (!urlMetadata.metaDescription) {
                improvements.push({
                  issue: "Meta-Description fehlt",
                  suggestion: "Füge eine Meta-Description hinzu (150-160 Zeichen)"
                });
              }
              if (!urlMetadata.headings.some(h => h.level === "H1")) {
                improvements.push({
                  issue: "H1-Überschrift fehlt",
                  suggestion: "Füge eine H1-Überschrift als Haupttitel der Seite hinzu"
                });
              } else if (urlMetadata.headings.filter(h => h.level === "H1").length > 1) {
                improvements.push({
                  issue: "Mehrere H1-Überschriften",
                  suggestion: `Reduziere die ${urlMetadata.headings.filter(h => h.level === "H1").length} H1-Überschriften auf genau eine`
                });
              }
              if (!urlMetadata.headings.some(h => h.level === "H2")) {
                improvements.push({
                  issue: "H2-Überschriften fehlen",
                  suggestion: "Strukturiere den Content mit H2-Überschriften für Abschnitte"
                });
              }
            }
            
            if (improvements.length === 0) return null;
            
            return (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Verbesserungsvorschläge ({improvements.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {taskCopySuccess && (
                      <span className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Kopiert
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const taskText = `Content-Optimierung: ${urlMetadata?.title || urlMetadata?.url || "Content Analyse"}
${urlMetadata?.url ? `URL: ${urlMetadata.url}\n` : ""}${keyword ? `Keyword: ${keyword}\n` : ""}
Verbesserungsvorschläge (${improvements.length}):

${improvements.map((imp, i) => `${i + 1}. ${imp.issue}
   → ${imp.suggestion}`).join("\n\n")}

Aktuelle Werte:
- Wörter: ${analysis.wordCount}
- Lesbarkeit: ${analysis.readabilityScore}/100 (${analysis.readabilityLabel})
- Wörter/Satz: ${analysis.avgWordsPerSentence}
${keyword ? `- Keyword-Dichte: ${analysis.keywordDensity.toFixed(2)}%` : ""}`;
                        
                        await navigator.clipboard.writeText(taskText);
                        setTaskCopySuccess(true);
                        setTimeout(() => setTaskCopySuccess(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 rounded-lg transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Als Task kopieren
                    </button>
                  </div>
                </div>
                
                <ul className="space-y-3">
                  {improvements.map((imp, index) => (
                    <li key={index} className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200 flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {imp.issue}
                      </p>
                      <p className="text-amber-700 dark:text-amber-300 ml-6 mt-0.5">
                        → {imp.suggestion}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>

        {/* Analysis Results */}
        <div className="space-y-4">
          {showAnalysis && analysis ? (
            <>
              {/* Quick Stats */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Übersicht</h3>
                <div className="grid grid-cols-2 gap-4">
                  <StatBox label="Wörter" value={analysis.wordCount.toLocaleString()} />
                  <StatBox label="Zeichen" value={analysis.charCount.toLocaleString()} />
                  <StatBox label="Sätze" value={analysis.sentenceCount.toString()} />
                  <StatBox label="Absätze" value={analysis.paragraphCount.toString()} />
                  <StatBox label="Lesezeit" value={`${analysis.readingTime} min`} />
                  <StatBox label="Wörter/Satz" value={analysis.avgWordsPerSentence.toString()} />
                </div>
              </div>

              {/* Readability */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Lesbarkeit</h3>
                  <div className="relative group">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-help transition-colors">
                      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 3.75 3.75 0 1 1 0 5.304.75.75 0 0 1 1.06-1.06 2.25 2.25 0 1 0 0-3.183ZM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                    </svg>
                    <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-50">
                      <p className="mb-1">Berechnung nach dem <strong>Flesch-Reading-Ease</strong>-Index, angepasst für deutsche Texte.</p>
                      <a href="https://simple.wikipedia.org/wiki/Flesch_Reading_Ease" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">
                        Mehr erfahren →
                      </a>
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-slate-900 dark:border-t-slate-700" />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Score</span>
                    <span className={`font-semibold ${
                      analysis.readabilityScore >= 50 ? "text-green-600" : 
                      analysis.readabilityScore >= 30 ? "text-amber-600" : "text-red-600"
                    }`}>
                      {analysis.readabilityScore}/100
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        analysis.readabilityScore >= 50 ? "bg-green-500" : 
                        analysis.readabilityScore >= 30 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${analysis.readabilityScore}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-500">{analysis.readabilityLabel}</p>
                </div>
              </div>

              {/* Keyword Analysis */}
              {keyword && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Keyword-Analyse</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Keyword</span>
                      <span className="font-medium text-slate-900 dark:text-white">{keyword}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Vorkommen</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{analysis.keywordCount}x</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Dichte</span>
                      <span className={`font-semibold ${
                        analysis.keywordDensity >= 1 && analysis.keywordDensity <= 2.5 ? "text-green-600" :
                        analysis.keywordDensity > 2.5 ? "text-red-600" : "text-amber-600"
                      }`}>
                        {analysis.keywordDensity.toFixed(2)}%
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                      <p className="text-xs text-slate-500">
                        {analysis.keywordDensity < 1 && "Die Keyword-Dichte ist niedrig. Versuche das Keyword natürlicher einzubauen."}
                        {analysis.keywordDensity >= 1 && analysis.keywordDensity <= 2.5 && "Optimale Keyword-Dichte!"}
                        {analysis.keywordDensity > 2.5 && "Die Keyword-Dichte ist hoch. Vermeide Keyword-Stuffing."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Headings from URL */}
              {urlMetadata && urlMetadata.headings.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Überschriften-Struktur</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {urlMetadata.headings.map((heading, index) => (
                      <div 
                        key={index} 
                        className="flex items-start gap-2"
                        style={{ paddingLeft: `${(parseInt(heading.level.substring(1)) - 1) * 12}px` }}
                      >
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                          heading.level === "H1" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" :
                          heading.level === "H2" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                          "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        }`}>
                          {heading.level}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                          {heading.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SEO Checklist */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">SEO Checkliste</h3>
                <ul className="space-y-2">
                  <ChecklistItem 
                    checked={analysis.wordCount >= 300} 
                    label="Mindestens 300 Wörter" 
                  />
                  <ChecklistItem 
                    checked={analysis.wordCount >= 1000} 
                    label="Mindestens 1000 Wörter (empfohlen)" 
                  />
                  <ChecklistItem 
                    checked={analysis.avgWordsPerSentence <= 20} 
                    label="Kurze Sätze (max. 20 Wörter/Satz)" 
                  />
                  <ChecklistItem 
                    checked={analysis.paragraphCount >= 3} 
                    label="Mehrere Absätze vorhanden" 
                  />
                  {keyword && (
                    <>
                      <ChecklistItem 
                        checked={analysis.keywordCount > 0} 
                        label="Keyword im Text vorhanden" 
                      />
                      <ChecklistItem 
                        checked={analysis.keywordDensity >= 1 && analysis.keywordDensity <= 2.5} 
                        label="Optimale Keyword-Dichte (1-2.5%)" 
                      />
                    </>
                  )}
                  {urlMetadata && (
                    <>
                      <ChecklistItem 
                        checked={!!urlMetadata.title} 
                        label="Title-Tag vorhanden" 
                      />
                      <ChecklistItem 
                        checked={!!urlMetadata.metaDescription} 
                        label="Meta-Description vorhanden" 
                      />
                      <ChecklistItem 
                        checked={urlMetadata.headings.some(h => h.level === "H1")} 
                        label="H1-Überschrift vorhanden" 
                      />
                      <ChecklistItem 
                        checked={urlMetadata.headings.filter(h => h.level === "H1").length === 1} 
                        label="Genau eine H1-Überschrift" 
                      />
                      <ChecklistItem 
                        checked={urlMetadata.headings.some(h => h.level === "H2")} 
                        label="H2-Überschriften vorhanden" 
                      />
                    </>
                  )}
                </ul>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center min-h-[200px]">
              <p className="text-slate-500 text-center">
                Füge Content ein und klicke auf "Analysieren"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      <div className="text-lg font-semibold text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {checked ? (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className={`text-sm ${checked ? "text-slate-700 dark:text-slate-300" : "text-slate-400"}`}>
        {label}
      </span>
    </li>
  );
}

// Simple syllable counter for German text
function countSyllables(word: string): number {
  const vowels = "aeiouyäöü";
  let count = 0;
  let prevWasVowel = false;
  
  for (const char of word.toLowerCase()) {
    const isVowel = vowels.includes(char);
    if (isVowel && !prevWasVowel) {
      count++;
    }
    prevWasVowel = isVowel;
  }
  
  return Math.max(1, count);
}
