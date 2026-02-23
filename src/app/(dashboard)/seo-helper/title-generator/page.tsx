"use client";

import { useState } from "react";
import Link from "next/link";

interface GeneratedTitle {
  title: string;
  length: number;
  isOptimal: boolean;
}

interface GeneratedDescription {
  description: string;
  length: number;
  isOptimal: boolean;
}

export default function TitleGeneratorPage() {
  const [keyword, setKeyword] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<"professional" | "casual" | "urgent" | "informative">("professional");
  const [titles, setTitles] = useState<GeneratedTitle[]>([]);
  const [descriptions, setDescriptions] = useState<GeneratedDescription[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"titles" | "descriptions">("titles");

  const generateTitles = () => {
    if (!keyword.trim()) return;
    
    setIsGenerating(true);
    
    // Simuliere AI-Generierung mit vordefinierten Patterns
    setTimeout(() => {
      const patterns = getTitlePatterns(keyword.trim(), topic.trim(), tone);
      const generatedTitles = patterns.map(title => ({
        title,
        length: title.length,
        isOptimal: title.length >= 50 && title.length <= 60,
      }));
      setTitles(generatedTitles);
      
      const descPatterns = getDescriptionPatterns(keyword.trim(), topic.trim(), tone);
      const generatedDescs = descPatterns.map(desc => ({
        description: desc,
        length: desc.length,
        isOptimal: desc.length >= 150 && desc.length <= 160,
      }));
      setDescriptions(generatedDescs);
      
      setIsGenerating(false);
    }, 800);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Title Generator</h1>
          <p className="text-slate-500 dark:text-slate-400">SEO-optimierte Titel und Meta-Descriptions</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Haupt-Keyword *
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="z.B. Kredit vergleichen"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Thema/Kontext (optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="z.B. Ratgeber für Erstkäufer"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Tonalität
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "professional", label: "Professionell" },
              { value: "casual", label: "Locker" },
              { value: "urgent", label: "Dringend" },
              { value: "informative", label: "Informativ" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTone(option.value as typeof tone)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tone === option.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generateTitles}
          disabled={!keyword.trim() || isGenerating}
          className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generiere...
            </span>
          ) : (
            "Generieren"
          )}
        </button>
      </div>

      {/* Results Section */}
      {(titles.length > 0 || descriptions.length > 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("titles")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "titles"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Title Tags ({titles.length})
            </button>
            <button
              onClick={() => setActiveTab("descriptions")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "descriptions"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Meta Descriptions ({descriptions.length})
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {activeTab === "titles" ? (
              titles.map((item, index) => (
                <ResultCard
                  key={index}
                  text={item.title}
                  length={item.length}
                  isOptimal={item.isOptimal}
                  optimalRange="50-60"
                  onCopy={() => copyToClipboard(item.title)}
                />
              ))
            ) : (
              descriptions.map((item, index) => (
                <ResultCard
                  key={index}
                  text={item.description}
                  length={item.length}
                  isOptimal={item.isOptimal}
                  optimalRange="150-160"
                  onCopy={() => copyToClipboard(item.description)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">SEO Best Practices</h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>Title Tags:</strong> Optimal 50-60 Zeichen, Keyword am Anfang platzieren</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>Meta Descriptions:</strong> Optimal 150-160 Zeichen, Call-to-Action einbauen</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span><strong>Einzigartigkeit:</strong> Jede Seite sollte einen individuellen Title und Description haben</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function ResultCard({ 
  text, 
  length, 
  isOptimal, 
  optimalRange, 
  onCopy 
}: { 
  text: string; 
  length: number; 
  isOptimal: boolean; 
  optimalRange: string;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
      <p className="text-slate-900 dark:text-white mb-3">{text}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            isOptimal 
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
          }`}>
            {length} Zeichen
          </span>
          <span className="text-xs text-slate-500">
            Optimal: {optimalRange}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {copied ? (
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
              Kopieren
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Helper functions for generating titles and descriptions
function getTitlePatterns(keyword: string, topic: string, tone: string): string[] {
  const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  const year = new Date().getFullYear();
  
  const patterns: Record<string, string[]> = {
    professional: [
      `${capitalizedKeyword}: Der umfassende Ratgeber ${year}`,
      `${capitalizedKeyword} - Alles was Sie wissen müssen`,
      `${capitalizedKeyword} im Überblick | Experten-Guide`,
      `${capitalizedKeyword}: Tipps, Kosten & Anbieter im Vergleich`,
      `Alles über ${capitalizedKeyword} - Kompakter Leitfaden`,
    ],
    casual: [
      `${capitalizedKeyword} einfach erklärt - So geht's!`,
      `${capitalizedKeyword}: Das musst du wissen`,
      `Der ultimative Guide zu ${capitalizedKeyword}`,
      `${capitalizedKeyword} - Dein Wegweiser zum Erfolg`,
      `So funktioniert ${capitalizedKeyword} wirklich`,
    ],
    urgent: [
      `${capitalizedKeyword}: Jetzt handeln & profitieren!`,
      `Verpassen Sie nicht: ${capitalizedKeyword} ${year}`,
      `${capitalizedKeyword} - Die wichtigsten Infos sofort`,
      `Achtung: Das sollten Sie über ${capitalizedKeyword} wissen`,
      `${capitalizedKeyword}: Schnell & einfach erklärt`,
    ],
    informative: [
      `Was ist ${capitalizedKeyword}? Definition & Erklärung`,
      `${capitalizedKeyword}: Bedeutung, Arten & Beispiele`,
      `${capitalizedKeyword} verstehen - Ein Leitfaden`,
      `Grundlagen zu ${capitalizedKeyword} | Übersicht ${year}`,
      `${capitalizedKeyword}: FAQ & häufige Fragen beantwortet`,
    ],
  };

  let results = patterns[tone] || patterns.professional;
  
  // Add topic-specific variations if topic is provided
  if (topic) {
    results = results.map((title, index) => {
      if (index === 0) return `${capitalizedKeyword} für ${topic} | Guide ${year}`;
      return title;
    });
  }

  return results;
}

function getDescriptionPatterns(keyword: string, topic: string, tone: string): string[] {
  const year = new Date().getFullYear();
  
  const patterns: Record<string, string[]> = {
    professional: [
      `Erfahren Sie alles Wichtige über ${keyword}. Unser umfassender Ratgeber bietet Ihnen Expertenwissen, aktuelle Informationen und praktische Tipps für ${year}.`,
      `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} verständlich erklärt: Kosten, Anbieter und wichtige Faktoren im Überblick. Jetzt informieren und die richtige Entscheidung treffen.`,
      `Der komplette Guide zu ${keyword}: Von den Grundlagen bis zu Expertentipps. Aktuelle Informationen und Vergleiche für Ihre Entscheidung.`,
      `Alles über ${keyword} auf einen Blick. Profitieren Sie von unserem Fachwissen und treffen Sie fundierte Entscheidungen. Jetzt mehr erfahren!`,
    ],
    casual: [
      `Du willst mehr über ${keyword} wissen? Hier findest du alle Infos - einfach erklärt und auf den Punkt gebracht. Schau rein!`,
      `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} muss nicht kompliziert sein! Wir zeigen dir, worauf es ankommt und geben dir praktische Tipps für den Alltag.`,
      `Endlich ${keyword} verstehen! Unser Guide erklärt dir alles Wichtige - ohne Fachchinesisch, dafür mit hilfreichen Beispielen.`,
      `Dein Wegweiser durch das Thema ${keyword}. Einfach, verständlich und mit allen Infos, die du brauchst. Los geht's!`,
    ],
    urgent: [
      `Jetzt über ${keyword} informieren! Erfahren Sie die wichtigsten Fakten und Tipps - kompakt zusammengefasst für schnelle Entscheidungen.`,
      `Verpassen Sie nicht die wichtigsten Infos zu ${keyword}! Aktuelle Daten, Vergleiche und Expertentipps - alles an einem Ort.`,
      `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} ${year}: Das müssen Sie jetzt wissen! Schneller Überblick mit allen relevanten Informationen.`,
      `Zeit ist Geld - holen Sie sich jetzt alle wichtigen Infos zu ${keyword}. Kompakt, aktuell und praxisnah aufbereitet.`,
    ],
    informative: [
      `Was ist ${keyword}? Definition, Bedeutung und praktische Anwendung verständlich erklärt. Ihr Wissens-Guide mit Beispielen und FAQ.`,
      `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} im Detail: Lernen Sie die Grundlagen, Varianten und Einsatzmöglichkeiten kennen. Fundiertes Wissen für Einsteiger und Fortgeschrittene.`,
      `Umfassende Informationen zu ${keyword}: Begriffserklärung, Funktionsweise und wichtige Aspekte. Bildung Sie sich Ihre eigene Meinung.`,
      `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} A-Z: Von der Definition bis zur praktischen Umsetzung. Ihr Nachschlagewerk für alle Fragen rund um das Thema.`,
    ],
  };

  let results = patterns[tone] || patterns.professional;
  
  if (topic) {
    results[0] = `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} für ${topic}: Unser Ratgeber erklärt alles Wichtige - von Grundlagen bis Expertentipps. Jetzt informieren!`;
  }

  return results;
}
