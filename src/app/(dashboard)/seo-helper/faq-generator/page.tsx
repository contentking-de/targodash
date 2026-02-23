"use client";

import { useState } from "react";
import Link from "next/link";

interface FAQ {
  question: string;
  searchIntent: string;
  questionType: string;
}

interface FAQCheckResult {
  question: string;
  status: "found" | "partial" | "missing";
  matchType: "exact" | "similar" | "semantic" | "none";
  evidence?: string;
  confidence: number;
}

interface CheckSummary {
  total: number;
  found: number;
  partial: number;
  missing: number;
  coverage: number;
}

export default function FAQGeneratorPage() {
  const [keyword, setKeyword] = useState("");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"ai" | "pattern" | "">("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // URL Check State
  const [checkUrl, setCheckUrl] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [checkResults, setCheckResults] = useState<FAQCheckResult[]>([]);
  const [checkSummary, setCheckSummary] = useState<CheckSummary | null>(null);
  const [taskCopySuccess, setTaskCopySuccess] = useState(false);

  const handleGenerate = async () => {
    if (!keyword.trim()) return;

    setIsLoading(true);
    setError("");
    setFaqs([]);
    setSource("");
    setCheckResults([]);
    setCheckSummary(null);
    setCheckError("");

    try {
      const response = await fetch("/api/seo-helper/generate-faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), count: 10 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler bei der Generierung");
      }

      setFaqs(data.faqs);
      setSource(data.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsLoading(false);
    }
  };

  const copyQuestion = (index: number) => {
    navigator.clipboard.writeText(faqs[index].question);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllQuestions = () => {
    const allQuestions = faqs.map((faq, i) => `${i + 1}. ${faq.question}`).join("\n");
    navigator.clipboard.writeText(allQuestions);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCheckUrl = async () => {
    if (!checkUrl.trim() || faqs.length === 0) return;

    setIsChecking(true);
    setCheckError("");
    setCheckResults([]);
    setCheckSummary(null);

    try {
      const response = await fetch("/api/seo-helper/check-faqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: checkUrl.trim(), faqs }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fehler bei der Prüfung");
      }

      setCheckResults(data.results);
      setCheckSummary(data.summary);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "found":
        return "bg-green-600 text-white";
      case "partial":
        return "bg-amber-500 text-white";
      case "missing":
        return "bg-red-500 text-white";
      default:
        return "bg-slate-500 text-white";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "found":
        return "Beantwortet";
      case "partial":
        return "Teilweise";
      case "missing":
        return "Fehlt";
      default:
        return status;
    }
  };

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case "exact":
        return "Exakt";
      case "similar":
        return "Ähnlich";
      case "semantic":
        return "Inhaltlich";
      case "none":
        return "";
      default:
        return matchType;
    }
  };

  const getIntentColor = (intent: string) => {
    switch (intent) {
      case "informational":
        return "bg-blue-600 text-white dark:bg-blue-500 dark:text-white";
      case "transactional":
        return "bg-green-600 text-white dark:bg-green-500 dark:text-white";
      case "navigational":
        return "bg-purple-600 text-white dark:bg-purple-500 dark:text-white";
      default:
        return "bg-slate-600 text-white dark:bg-slate-500 dark:text-white";
    }
  };

  const getIntentLabel = (intent: string) => {
    switch (intent) {
      case "informational":
        return "Informational";
      case "transactional":
        return "Transactional";
      case "navigational":
        return "Navigational";
      default:
        return intent;
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
        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 shadow-lg shadow-indigo-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">FAQ Generator</h1>
          <p className="text-slate-500 dark:text-slate-400">Generiere häufig gestellte Fragen für dein Keyword</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Keyword oder Thema
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="z.B. Kredit vergleichen, Girokonto, Tagesgeld Zinsen..."
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleGenerate}
              disabled={!keyword.trim() || isLoading}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generiere...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generieren
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Results Section */}
      {faqs.length > 0 && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {faqs.length} FAQs generiert
              </h2>
              {source === "ai" && (
                <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-full">
                  KI-generiert
                </span>
              )}
              {source === "pattern" && (
                <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 rounded-full">
                  Template-basiert
                </span>
              )}
            </div>
            <button
              onClick={copyAllQuestions}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {copiedAll ? (
                <>
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Kopiert!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Alle kopieren
                </>
              )}
            </button>
          </div>

          {/* FAQ List */}
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-white font-medium">
                      {faq.question}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getIntentColor(faq.searchIntent)}`}>
                        {getIntentLabel(faq.searchIntent)}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                        {faq.questionType.charAt(0).toUpperCase() + faq.questionType.slice(1)}-Frage
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyQuestion(index)}
                    className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all"
                    title="Frage kopieren"
                  >
                    {copiedIndex === index ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* URL Check Section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">URL auf vorhandene Antworten prüfen</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Prüfe, ob diese Fragen auf einer Seite bereits beantwortet werden
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <input
                type="url"
                value={checkUrl}
                onChange={(e) => setCheckUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckUrl()}
                placeholder="https://www.beispiel.ch/seite"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={handleCheckUrl}
                disabled={!checkUrl.trim() || isChecking}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isChecking ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Prüfe...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Prüfen
                  </>
                )}
              </button>
            </div>

            {checkError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{checkError}</p>
              </div>
            )}
          </div>

          {/* Check Results */}
          {checkSummary && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Ergebnis der Prüfung</h3>
                
                {/* Coverage Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Content-Abdeckung</span>
                    <span className={`font-semibold ${
                      checkSummary.coverage >= 70 ? "text-green-600" :
                      checkSummary.coverage >= 40 ? "text-amber-600" : "text-red-600"
                    }`}>
                      {checkSummary.coverage}%
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        checkSummary.coverage >= 70 ? "bg-green-500" :
                        checkSummary.coverage >= 40 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${checkSummary.coverage}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{checkSummary.found}</div>
                    <div className="text-xs text-green-700 dark:text-green-300">Beantwortet</div>
                  </div>
                  <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{checkSummary.partial}</div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">Teilweise</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{checkSummary.missing}</div>
                    <div className="text-xs text-red-700 dark:text-red-300">Fehlt</div>
                  </div>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="space-y-3">
                {checkResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`bg-white dark:bg-slate-800 rounded-xl border p-4 ${
                      result.status === "found" 
                        ? "border-green-200 dark:border-green-800" 
                        : result.status === "partial"
                        ? "border-amber-200 dark:border-amber-800"
                        : "border-red-200 dark:border-red-800"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        result.status === "found" 
                          ? "bg-green-100 dark:bg-green-900/50" 
                          : result.status === "partial"
                          ? "bg-amber-100 dark:bg-amber-900/50"
                          : "bg-red-100 dark:bg-red-900/50"
                      }`}>
                        {result.status === "found" ? (
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : result.status === "partial" ? (
                          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 dark:text-white font-medium">
                          {result.question}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(result.status)}`}>
                            {getStatusLabel(result.status)}
                          </span>
                          {result.matchType !== "none" && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300">
                              {getMatchTypeLabel(result.matchType)}
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            {result.confidence}% Konfidenz
                          </span>
                        </div>
                        {result.evidence && (
                          <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                              &quot;{result.evidence}&quot;
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendation */}
              <div className={`rounded-xl p-4 border ${
                checkSummary.coverage >= 70 
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : checkSummary.coverage >= 40
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              }`}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className={`font-medium ${
                    checkSummary.coverage >= 70 
                      ? "text-green-900 dark:text-green-100"
                      : checkSummary.coverage >= 40
                      ? "text-amber-900 dark:text-amber-100"
                      : "text-red-900 dark:text-red-100"
                  }`}>
                    {checkSummary.coverage >= 70 
                      ? "Gute Abdeckung!" 
                      : checkSummary.coverage >= 40 
                      ? "Verbesserungspotenzial" 
                      : "Content-Lücken gefunden"}
                  </h3>
                  
                  {/* Copy Button - nur anzeigen wenn es fehlende/teilweise Fragen gibt */}
                  {checkResults.some(r => r.status === "missing" || r.status === "partial") && (
                    <div className="flex items-center gap-2">
                      {taskCopySuccess && (
                        <span className="text-sm text-green-700 dark:text-green-400 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          ToDos erfolgreich kopiert
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const missingQuestions = checkResults.filter(r => r.status === "missing");
                          const partialQuestions = checkResults.filter(r => r.status === "partial");
                          
                          const taskText = `FAQ Content-Optimierung: ${keyword}
URL: ${checkUrl}

${missingQuestions.length > 0 ? `Fehlende Antworten (${missingQuestions.length}):
${missingQuestions.map((q, i) => `${i + 1}. ${q.question}`).join("\n")}` : ""}

${partialQuestions.length > 0 ? `Unvollständige Antworten (${partialQuestions.length}):
${partialQuestions.map((q, i) => `${i + 1}. ${q.question}
   → ${q.evidence || "Antwort erweitern"}`).join("\n")}` : ""}

Empfehlung: ${checkSummary.coverage >= 40 
                            ? "Ergänze den Content um die fehlenden Themen für bessere Rankings."
                            : "Erwäge, den Content deutlich zu erweitern oder eine FAQ-Sektion hinzuzufügen."}`;
                          
                          await navigator.clipboard.writeText(taskText.trim());
                          setTaskCopySuccess(true);
                          setTimeout(() => setTaskCopySuccess(false), 2000);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm ${
                          checkSummary.coverage >= 40
                            ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
                            : "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Als Task kopieren
                      </button>
                    </div>
                  )}
                </div>
                
                <p className={`text-sm mb-4 ${
                  checkSummary.coverage >= 70 
                    ? "text-green-800 dark:text-green-200"
                    : checkSummary.coverage >= 40
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-red-800 dark:text-red-200"
                }`}>
                  {checkSummary.coverage >= 70 
                    ? "Die meisten relevanten Fragen werden auf der Seite bereits beantwortet. Prüfe die fehlenden Fragen für weiteres Optimierungspotenzial."
                    : checkSummary.coverage >= 40 
                    ? "Einige wichtige Fragen werden noch nicht beantwortet. Ergänze den Content um die fehlenden Themen für bessere Rankings."
                    : "Viele wichtige Fragen werden auf der Seite nicht beantwortet. Erwäge, den Content deutlich zu erweitern oder eine FAQ-Sektion hinzuzufügen."}
                </p>

                {/* Konkrete Liste der fehlenden/teilweisen Fragen */}
                {checkResults.some(r => r.status === "missing" || r.status === "partial") && (
                  <div className="space-y-3 pt-3 border-t border-current/10">
                    {checkResults.filter(r => r.status === "missing").length > 0 && (
                      <div>
                        <h4 className={`text-sm font-medium mb-2 ${
                          checkSummary.coverage >= 40
                            ? "text-amber-800 dark:text-amber-200"
                            : "text-red-800 dark:text-red-200"
                        }`}>
                          Fehlende Antworten:
                        </h4>
                        <ul className="space-y-1">
                          {checkResults.filter(r => r.status === "missing").map((result, index) => (
                            <li key={index} className={`text-sm flex items-start gap-2 ${
                              checkSummary.coverage >= 40
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-red-700 dark:text-red-300"
                            }`}>
                              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {result.question}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {checkResults.filter(r => r.status === "partial").length > 0 && (
                      <div>
                        <h4 className={`text-sm font-medium mb-2 ${
                          checkSummary.coverage >= 40
                            ? "text-amber-800 dark:text-amber-200"
                            : "text-red-800 dark:text-red-200"
                        }`}>
                          Unvollständige Antworten:
                        </h4>
                        <ul className="space-y-1">
                          {checkResults.filter(r => r.status === "partial").map((result, index) => (
                            <li key={index} className={`text-sm ${
                              checkSummary.coverage >= 40
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-red-700 dark:text-red-300"
                            }`}>
                              <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {result.question}
                              </div>
                              {result.evidence && (
                                <p className="text-xs ml-6 mt-0.5 opacity-80">→ Vorhanden: &quot;{result.evidence}&quot;</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intent Legend */}
          {!checkSummary && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Suchintentionen erklärt</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white dark:bg-blue-500">
                    Informational
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Nutzer sucht Informationen
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-600 text-white dark:bg-green-500">
                    Transactional
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Nutzer will kaufen/handeln
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-600 text-white dark:bg-purple-500">
                    Navigational
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Nutzer sucht bestimmte Seite
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tips */}
          {!checkSummary && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
              <h3 className="font-medium text-indigo-900 dark:text-indigo-100 mb-2">Tipps zur Verwendung</h3>
              <ul className="text-sm text-indigo-800 dark:text-indigo-200 space-y-1">
                <li>• Nutze die FAQs für FAQ-Sektionen auf deinen Landingpages</li>
                <li>• Erstelle FAQ-Schema-Markup mit dem Schema Generator für Rich Snippets</li>
                <li>• Beantworte die Fragen ausführlich für bessere Featured Snippet-Chancen</li>
                <li>• Informational-Fragen eignen sich besonders für Blogbeiträge</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && faqs.length === 0 && !error && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="inline-flex p-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 mb-4">
            <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            FAQs generieren
          </h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Gib ein Keyword oder Thema ein, um 10 häufig gestellte Fragen zu generieren. 
            Die Fragen werden nach Suchintention kategorisiert.
          </p>
        </div>
      )}
    </div>
  );
}
