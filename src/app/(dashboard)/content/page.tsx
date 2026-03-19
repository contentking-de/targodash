"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type ContentType = "ratgeber" | "lexikon";

const CONTENT_TYPES: { value: ContentType; label: string; description: string }[] = [
  {
    value: "ratgeber",
    label: "Ratgeber-Artikel",
    description: "Ausführliche, SEO-optimierte Ratgeber zum Thema Baufinanzierung",
  },
  {
    value: "lexikon",
    label: "Lexikon-Artikel",
    description: "Kompakte Begriffserklärungen rund um Baufinanzierung & Immobilien",
  },
];

const RATGEBER_CATEGORIES = [
  "Erstfinanzierung",
  "Kapitalanlage",
  "Immobilie",
  "Anschlussfinanzierung",
  "Modernisierung",
  "Studien und Whitepaper",
  "Lexikon",
  "Checklisten für Käufer und Inhaber",
];

const LEXIKON_CATEGORIES = [
  "Finanzierungsbegriffe",
  "Immobilienbegriffe",
  "Rechtliche Begriffe",
  "Versicherungsbegriffe",
  "Steuerbegriffe",
  "Allgemeine Bankbegriffe",
];

const FUNNEL_OPTIONS = [
  { value: "Upper-Funnel", label: "Upper Funnel" },
  { value: "Mid-Funnel", label: "Mid Funnel" },
  { value: "Lower-Funnel", label: "Lower Funnel" },
];

const ZIELGRUPPEN = [
  "Erstkäufer",
  "Anschlussfinanzierer",
  "Selbstständige",
  "Familien",
  "Investoren",
];

interface SavedArticle {
  id: string;
  title: string;
  slug: string;
  funnelStage: string;
  category: string;
  targetAudience: string;
  wordCount: number;
  createdAt: string;
  creator: { name: string | null; email: string };
}

export default function ContentPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (session?.user?.role !== "agentur") {
    redirect("/");
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    }>
      <ContentPageInner />
    </Suspense>
  );
}

function ContentPageInner() {
  const searchParams = useSearchParams();
  const [contentType, setContentType] = useState<ContentType>(
    (searchParams.get("contentType") as ContentType) || "ratgeber"
  );
  const [title, setTitle] = useState(searchParams.get("title") || "");
  const [funnelStage, setFunnelStage] = useState(searchParams.get("funnel") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [targetAudiences, setTargetAudiences] = useState<string[]>([]);
  const [customAudience, setCustomAudience] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [editorialPlanEntryId] = useState(searchParams.get("editorialPlanEntryId") || "");
  const [fromRedaktionsplan] = useState(!!searchParams.get("editorialPlanEntryId"));

  const categories = contentType === "ratgeber" ? RATGEBER_CATEGORIES : LEXIKON_CATEGORIES;

  const [isGenerating, setIsGenerating] = useState(false);
  const [htmlContent, setHtmlContent] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  const [articles, setArticles] = useState<SavedArticle[]>([]);
  const [showArticles, setShowArticles] = useState(false);
  const [loadingArticles, setLoadingArticles] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const extractMeta = useCallback((html: string) => {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    setMetaTitle(titleMatch ? titleMatch[1].trim() : "");
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i);
    setMetaDescription(descMatch ? descMatch[1].trim() : "");
  }, []);

  const loadArticles = useCallback(async () => {
    setLoadingArticles(true);
    try {
      const res = await fetch("/api/articles");
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingArticles(false);
    }
  }, []);

  const handleGenerate = async () => {
    if (!title || !funnelStage || !category || targetAudiences.length === 0) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }

    setError("");
    setHtmlContent("");
    setMetaTitle("");
    setMetaDescription("");
    setIsGenerating(true);
    setSavedMessage("");

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, funnelStage, category, targetAudience: targetAudiences.join(", "), contentType }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Fehler bei der Generierung");
        setIsGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("Stream nicht verfügbar");
        setIsGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              accumulated += parsed.text;
              // Markdown-Codeblock-Marker entfernen, die Claude manchmal mitsende
              const cleaned = accumulated
                .replace(/^```html\s*\n?/, "")
                .replace(/\n?```\s*$/, "");
              setHtmlContent(cleaned);
            }
            if (parsed.error) {
              setError(parsed.error);
            }
          } catch {
            // Skip
          }
        }
      }

      extractMeta(accumulated);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled
      } else {
        setError("Verbindungsfehler: " + String(err));
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  };

  const handleSave = async () => {
    if (!htmlContent) return;

    setIsSaving(true);
    setSavedMessage("");

    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          funnelStage,
          category,
          targetAudience: targetAudiences.join(", "),
          htmlContent,
          contentType,
          metaTitle: metaTitle || undefined,
          metaDescription: metaDescription || undefined,
          editorialPlanEntryId: editorialPlanEntryId || undefined,
        }),
      });

      if (res.ok) {
        setSavedMessage(
          fromRedaktionsplan
            ? "Artikel gespeichert und mit Redaktionsplan verknüpft. Weiter zum Content Check zur Freigabe."
            : "Artikel gespeichert"
        );
        if (showArticles) loadArticles();
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Speichern");
      }
    } catch {
      setError("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!htmlContent) return;

    const slug = title
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || (contentType === "lexikon" ? "lexikon" : "artikel")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
      if (res.ok) {
        setArticles((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // Ignore
    }
  };

  const toggleArticles = () => {
    if (!showArticles) loadArticles();
    setShowArticles(!showArticles);
  };

  return (
    <div className="space-y-6">
      {/* Redaktionsplan-Hinweis */}
      {fromRedaktionsplan && (
        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4 flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-violet-900 dark:text-violet-200">
              Aus Redaktionsplan übernommen
            </p>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
              Titel, Kategorie und Funnel wurden automatisch vorausgefüllt. Wähle noch die Zielgruppe und starte die Generierung.
            </p>
          </div>
          <a
            href="/redaktionsplan"
            className="flex-shrink-0 text-xs text-violet-600 dark:text-violet-400 hover:underline"
          >
            Zurück zum Plan
          </a>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Content Generator
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            SEO-optimierte Ratgeber- und Lexikon-Artikel für die TARGOBANK Baufinanzierung generieren
          </p>
        </div>
        <button
          onClick={toggleArticles}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {showArticles ? "Archiv ausblenden" : "Archiv anzeigen"}
          {articles.length > 0 && (
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium px-2 py-0.5 rounded-full">
              {articles.length}
            </span>
          )}
        </button>
      </div>

      {/* Artikel-Archiv */}
      {showArticles && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Gespeicherte Artikel
            </h2>
          </div>
          {loadingArticles ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
              <svg className="animate-spin h-5 w-5 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Lade Artikel...
            </div>
          ) : articles.length === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400">
              Noch keine Artikel gespeichert.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                        {article.funnelStage}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        {article.category}
                      </span>
                      <span>{article.wordCount} Wörter</span>
                      <span>{new Date(article.createdAt).toLocaleDateString("de-DE")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => {
                        fetch(`/api/articles/${article.id}`)
                          .then((r) => r.json())
                          .then((data) => {
                            setHtmlContent(data.htmlContent);
                            setTitle(data.title);
                            setFunnelStage(data.funnelStage);
                            setCategory(data.category);
                            setTargetAudiences(
                              data.targetAudience
                                ? data.targetAudience.split(", ").filter(Boolean)
                                : []
                            );
                          });
                      }}
                      className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Vorschau laden"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(article.id)}
                      className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Löschen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:grid-rows-1 xl:h-[calc(100vh-12rem)]">
        {/* Linke Seite: Formular */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 xl:overflow-y-auto">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
            Artikel-Parameter
          </h2>

          <div className="space-y-5">
            {/* Content-Typ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Content-Typ
              </label>
              <div className="grid grid-cols-2 gap-3">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => {
                      setContentType(ct.value);
                      setCategory("");
                    }}
                    disabled={isGenerating}
                    className={`relative flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all ${
                      contentType === ct.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500"
                        : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
                    } ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span className={`text-sm font-semibold ${
                      contentType === ct.value
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-slate-900 dark:text-white"
                    }`}>
                      {ct.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {ct.description}
                    </span>
                    {contentType === ct.value && (
                      <div className="absolute top-2 right-2">
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Titel */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {contentType === "lexikon" ? "Lexikon-Begriff / Titel" : "Artikel-Titel"}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  contentType === "lexikon"
                    ? "z.B. Annuitätendarlehen, Grundschuld, Beleihungswert"
                    : "z.B. Baufinanzierung für Familien – So finden Sie das passende Darlehen"
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                disabled={isGenerating}
              />
            </div>

            {/* Funnel Stage */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Funnel-Stage
              </label>
              <select
                value={funnelStage}
                onChange={(e) => setFunnelStage(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                disabled={isGenerating}
              >
                <option value="">Bitte auswählen...</option>
                {FUNNEL_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {funnelStage === "Upper-Funnel" && "Grundlagen erklären, Begriffe einführen, geduldiger Ton"}
                {funnelStage === "Mid-Funnel" && "Optionen vergleichen, Vor-/Nachteile, Rechenbeispiele"}
                {funnelStage === "Lower-Funnel" && "Handlungsimpulse, letzte Unsicherheiten nehmen, klare nächste Schritte"}
              </p>
            </div>

            {/* Kategorie */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {contentType === "lexikon" ? "Lexikon-Kategorie" : "Ratgeber-Kategorie"}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                disabled={isGenerating}
              >
                <option value="">Bitte auswählen...</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Zielgruppe */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Zielgruppe(n)
              </label>
              <div className="flex flex-wrap gap-2">
                {ZIELGRUPPEN.map((z) => {
                  const selected = targetAudiences.includes(z);
                  return (
                    <button
                      key={z}
                      type="button"
                      disabled={isGenerating}
                      onClick={() =>
                        setTargetAudiences((prev) =>
                          selected ? prev.filter((a) => a !== z) : [...prev, z]
                        )
                      }
                      className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                        selected
                          ? "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400 dark:ring-blue-600"
                          : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500"
                      } ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {selected && (
                        <svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {z}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setShowCustomInput(!showCustomInput)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                    showCustomInput
                      ? "bg-slate-100 dark:bg-slate-700 border-slate-400 dark:border-slate-500 text-slate-700 dark:text-slate-300"
                      : "border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500"
                  } ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  + Eigene
                </button>
              </div>
              {showCustomInput && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={customAudience}
                    onChange={(e) => setCustomAudience(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customAudience.trim()) {
                        e.preventDefault();
                        if (!targetAudiences.includes(customAudience.trim())) {
                          setTargetAudiences((prev) => [...prev, customAudience.trim()]);
                        }
                        setCustomAudience("");
                      }
                    }}
                    placeholder="Eigene Zielgruppe eingeben + Enter"
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    disabled={isGenerating}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customAudience.trim() && !targetAudiences.includes(customAudience.trim())) {
                        setTargetAudiences((prev) => [...prev, customAudience.trim()]);
                      }
                      setCustomAudience("");
                    }}
                    disabled={isGenerating || !customAudience.trim()}
                    className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Hinzufügen
                  </button>
                </div>
              )}
              {targetAudiences.filter((a) => !ZIELGRUPPEN.includes(a)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {targetAudiences
                    .filter((a) => !ZIELGRUPPEN.includes(a))
                    .map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700"
                      >
                        {a}
                        <button
                          type="button"
                          onClick={() => setTargetAudiences((prev) => prev.filter((x) => x !== a))}
                          className="hover:text-red-500 transition-colors"
                          disabled={isGenerating}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                </div>
              )}
              {targetAudiences.length > 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  {targetAudiences.length} Zielgruppe{targetAudiences.length !== 1 ? "n" : ""} ausgewählt
                </p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            {isGenerating ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Abbrechen
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!title || !funnelStage || !category || targetAudiences.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
                Artikel generieren
              </button>
            )}

            {htmlContent && !isGenerating && (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {isSaving ? "Speichere..." : "In Datenbank speichern"}
                </button>

                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  HTML herunterladen
                </button>
              </>
            )}
          </div>

          {/* Saved message */}
          {savedMessage && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {savedMessage}
              </p>
              {fromRedaktionsplan && (
                <div className="mt-2 flex items-center gap-3">
                  <a
                    href="/content-check"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Zum Content Check
                  </a>
                  <a
                    href="/redaktionsplan"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Zurück zum Redaktionsplan
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rechte Seite: Preview */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col xl:h-full">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Vorschau
            </h2>
            {isGenerating && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generiere Artikel...
              </div>
            )}
          </div>

          {/* SEO Meta-Daten */}
          {(metaTitle || metaDescription) && !isGenerating && (
            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">SEO Meta-Daten</p>
              {metaTitle && (
                <div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Title Tag</span>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium leading-snug">{metaTitle}</p>
                  <span className={`text-[10px] ${metaTitle.length >= 50 && metaTitle.length <= 60 ? "text-emerald-500" : "text-amber-500"}`}>
                    {metaTitle.length} Zeichen {metaTitle.length < 50 ? "(zu kurz, ideal: 50–60)" : metaTitle.length > 60 ? "(zu lang, ideal: 50–60)" : "(optimal)"}
                  </span>
                </div>
              )}
              {metaDescription && (
                <div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Meta Description</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{metaDescription}</p>
                  <span className={`text-[10px] ${metaDescription.length >= 140 && metaDescription.length <= 160 ? "text-emerald-500" : "text-amber-500"}`}>
                    {metaDescription.length} Zeichen {metaDescription.length < 140 ? "(zu kurz, ideal: 140–160)" : metaDescription.length > 160 ? "(zu lang, ideal: 140–160)" : "(optimal)"}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 min-h-[600px] xl:min-h-0 relative">
            {htmlContent ? (
              <iframe
                ref={previewRef}
                srcDoc={htmlContent}
                className="w-full h-full absolute inset-0 border-0"
                sandbox="allow-same-origin"
                title="Artikel-Vorschau"
              />
            ) : (
              <div className="flex items-center justify-center h-full min-h-[600px] xl:min-h-0 text-slate-400 dark:text-slate-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="text-sm">Die generierte Vorschau erscheint hier</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
