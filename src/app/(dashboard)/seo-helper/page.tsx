"use client";

import Link from "next/link";

// Definiere die Helper mit ihren Eigenschaften
interface HelperCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  comingSoon?: boolean;
}

const helpers: HelperCard[] = [
  {
    id: "benchmarker",
    title: "Benchmarker",
    description: "Vergleiche deinen Content mit den Top-Konkurrenten in Deutschland und finde Content-Gaps und Verbesserungspotenziale.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    href: "/seo-helper/benchmarker",
    color: "from-orange-500 to-red-500",
  },
  {
    id: "title-generator",
    title: "Title Generator",
    description: "Generiere SEO-optimierte Titel und Meta-Descriptions basierend auf deinen Keywords und Inhalten.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
    href: "/seo-helper/title-generator",
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "serp-preview",
    title: "SERP Preview",
    description: "Vorschau wie deine Seite in den Google-Suchergebnissen erscheinen wird.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    href: "/seo-helper/serp-preview",
    color: "from-amber-500 to-orange-500",
  },
  {
    id: "schema-generator",
    title: "Schema Generator",
    description: "Erstelle strukturierte Daten (JSON-LD) für Rich Snippets wie FAQ, HowTo, Produkte und mehr.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    href: "/seo-helper/schema-generator",
    color: "from-pink-500 to-rose-500",
  },
  {
    id: "content-analyzer",
    title: "Content Analyzer",
    description: "Analysiere deinen Content auf SEO-Faktoren wie Keyword-Dichte, Lesbarkeit und Struktur.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    href: "/seo-helper/content-analyzer",
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: "keyword-clustering",
    title: "Keyword Clustering",
    description: "Gruppiere verwandte Keywords automatisch in thematische Cluster für eine bessere Content-Strategie.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    href: "/seo-helper/keyword-clustering",
    color: "from-violet-500 to-purple-500",
  },
  {
    id: "faq-generator",
    title: "FAQ Generator",
    description: "Generiere häufig gestellte Fragen (FAQs) basierend auf deinem Keyword für Content und Rich Snippets.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    href: "/seo-helper/faq-generator",
    color: "from-indigo-500 to-blue-500",
  },
  {
    id: "ai-summarizer",
    title: "AI Summarizer",
    description: "Lasse KI den Inhalt einer beliebigen Webseite zusammenfassen und die wichtigsten Informationen extrahieren.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    href: "/seo-helper/ai-summarizer",
    color: "from-cyan-500 to-blue-600",
  },
];

export default function SEOHelperPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/25">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            SEO Helper
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Praktische Tools für deinen SEO-Alltag
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-2xl p-6 border border-teal-200 dark:border-teal-800">
        <p className="text-slate-700 dark:text-slate-300">
          Hier findest du eine Sammlung von kleinen, aber mächtigen Tools, die dir bei täglichen SEO-Aufgaben helfen. 
          Von der Titel-Optimierung bis zur Schema-Markup-Generierung – wähle einfach den passenden Helper aus.
        </p>
      </div>

      {/* Helper Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {helpers.map((helper) => (
          <HelperCardComponent key={helper.id} helper={helper} />
        ))}
      </div>

      {/* Info Note */}
      <div className="text-center text-slate-500 dark:text-slate-400 text-sm">
        <p>Hast du Ideen für weitere Helper? Erstelle ein Feature-Request im Bugs & Features Bereich.</p>
      </div>
    </div>
  );
}

function HelperCardComponent({ helper }: { helper: HelperCard }) {
  const cardClassName = `group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 transition-all duration-300 ${
    helper.comingSoon 
      ? "opacity-75 cursor-not-allowed" 
      : "hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-1"
  }`;

  const cardContent = (
    <>
      {/* Coming Soon Badge */}
      {helper.comingSoon && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
            Coming Soon
          </span>
        </div>
      )}
      
      {/* Icon */}
      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${helper.color} text-white mb-4 shadow-lg`}>
        {helper.icon}
      </div>
      
      {/* Title */}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
        {helper.title}
      </h3>
      
      {/* Description */}
      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
        {helper.description}
      </p>
      
      {/* Arrow indicator (only for active links) */}
      {!helper.comingSoon && (
        <div className="mt-4 flex items-center text-teal-600 dark:text-teal-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Öffnen</span>
          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </>
  );

  if (helper.comingSoon) {
    return <div className={cardClassName}>{cardContent}</div>;
  }

  return (
    <Link href={helper.href} className={cardClassName}>
      {cardContent}
    </Link>
  );
}
