"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SERPPreviewPage() {
  const [url, setUrl] = useState("https://www.beispiel.de/ratgeber/kredit");
  const [title, setTitle] = useState("Kredit vergleichen: Der umfassende Ratgeber 2026");
  const [description, setDescription] = useState("Erfahren Sie alles Wichtige über Kredite in Deutschland. Unser umfassender Ratgeber bietet Ihnen Expertenwissen, aktuelle Zinsen und praktische Tipps.");
  const [favicon, setFavicon] = useState("");
  const [previewType, setPreviewType] = useState<"desktop" | "mobile">("desktop");

  // Calculate character counts
  const titleLength = title.length;
  const descLength = description.length;
  const titleOptimal = titleLength >= 50 && titleLength <= 60;
  const descOptimal = descLength >= 150 && descLength <= 160;

  // Extract domain from URL
  const getDomain = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname;
    } catch {
      return urlString;
    }
  };

  const getBreadcrumb = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      const path = urlObj.pathname.split('/').filter(Boolean);
      if (path.length === 0) return urlObj.hostname;
      return `${urlObj.hostname} › ${path.join(' › ')}`;
    } catch {
      return urlString;
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
        <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SERP Preview</h1>
          <p className="text-slate-500 dark:text-slate-400">Vorschau deiner Google-Suchergebnisse</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Meta-Daten eingeben</h2>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.beispiel.ch/seite"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Title Tag
                </label>
                <span className={`text-xs font-medium ${titleOptimal ? 'text-green-600' : titleLength > 60 ? 'text-red-600' : 'text-amber-600'}`}>
                  {titleLength}/60 Zeichen
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Seitentitel"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    titleLength <= 50 ? 'bg-amber-500' : 
                    titleLength <= 60 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((titleLength / 70) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Meta Description
                </label>
                <span className={`text-xs font-medium ${descOptimal ? 'text-green-600' : descLength > 160 ? 'text-red-600' : 'text-amber-600'}`}>
                  {descLength}/160 Zeichen
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Meta-Beschreibung"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
              <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    descLength <= 150 ? 'bg-amber-500' : 
                    descLength <= 160 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((descLength / 170) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${titleOptimal ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
              <div className="flex items-center gap-2 mb-1">
                {titleOptimal ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <span className={`text-sm font-medium ${titleOptimal ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  Title Tag
                </span>
              </div>
              <p className={`text-xs ${titleOptimal ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500'}`}>
                {titleOptimal ? 'Optimale Länge' : titleLength < 50 ? 'Zu kurz (min. 50)' : 'Zu lang (max. 60)'}
              </p>
            </div>

            <div className={`p-4 rounded-xl border ${descOptimal ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
              <div className="flex items-center gap-2 mb-1">
                {descOptimal ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <span className={`text-sm font-medium ${descOptimal ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  Description
                </span>
              </div>
              <p className={`text-xs ${descOptimal ? 'text-green-600 dark:text-green-500' : 'text-amber-600 dark:text-amber-500'}`}>
                {descOptimal ? 'Optimale Länge' : descLength < 150 ? 'Zu kurz (min. 150)' : 'Zu lang (max. 160)'}
              </p>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="space-y-4">
          {/* Device Toggle */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">Live-Vorschau</h2>
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setPreviewType("desktop")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  previewType === "desktop"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => setPreviewType("mobile")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  previewType === "mobile"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Google SERP Preview */}
          <div className={`bg-white rounded-2xl border border-slate-200 p-6 ${previewType === "mobile" ? "max-w-sm mx-auto" : ""}`}>
            <div className="space-y-5">
              {/* Google Logo */}
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <svg viewBox="0 0 272 92" className="h-8">
                  <path fill="#4285F4" d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
                  <path fill="#EA4335" d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z"/>
                  <path fill="#FBBC05" d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z"/>
                  <path fill="#4285F4" d="M225 3v65h-9.5V3h9.5z"/>
                  <path fill="#34A853" d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z"/>
                  <path fill="#EA4335" d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z"/>
                </svg>
              </div>

              {/* Search Result */}
              <div className="space-y-1">
                {/* URL/Breadcrumb */}
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-slate-700 text-sm">{getDomain(url)}</div>
                    <div className="text-slate-500 text-xs">{getBreadcrumb(url)}</div>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-xl text-blue-800 hover:underline cursor-pointer leading-tight">
                  {title || "Seitentitel eingeben..."}
                  {titleLength > 60 && <span className="text-slate-400">...</span>}
                </h3>

                {/* Description */}
                <p className="text-sm text-slate-600 leading-relaxed">
                  {description || "Meta-Beschreibung eingeben..."}
                  {descLength > 160 && <span className="text-slate-400">...</span>}
                </p>
              </div>

              {/* Simulated second result (faded) */}
              <div className="opacity-40 space-y-1 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-7 h-7 rounded-full bg-slate-100"></div>
                  <div className="h-3 w-32 bg-slate-200 rounded"></div>
                </div>
                <div className="h-5 w-3/4 bg-slate-200 rounded"></div>
                <div className="h-3 w-full bg-slate-100 rounded"></div>
                <div className="h-3 w-2/3 bg-slate-100 rounded"></div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Tipp:</strong> Google kann Title und Description je nach Suchanfrage anpassen. Diese Vorschau zeigt die wahrscheinlichste Darstellung.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
