"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactElement;
  description: string;
  content: DocArticle[];
}

interface DocArticle {
  title: string;
  body: string;
  link?: string;
  linkLabel?: string;
}

const docSections: DocSection[] = [
  {
    id: "erste-schritte",
    title: "Erste Schritte",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    description: "Schnellstart-Anleitung für neue Nutzer",
    content: [
      {
        title: "Anmeldung & Google-Verknüpfung",
        body: "Nach der ersten Anmeldung im SEO Dashboard musst du deinen Google Account verknüpfen, um auf die Google Search Console Daten zugreifen zu können. Klicke dazu auf den Button \"Connect with Google\" in der oberen Leiste oder gehe in die Einstellungen. Die Verknüpfung erlaubt dem Dashboard, deine GSC-Daten abzurufen und auszuwerten.",
        link: "/settings",
        linkLabel: "Zu den Einstellungen",
      },
      {
        title: "Property auswählen",
        body: "Oben links im Header findest du den Property Selector. Hier kannst du zwischen deinen verschiedenen Google Search Console Properties wechseln. Alle Daten im Dashboard beziehen sich immer auf die aktuell ausgewählte Property.",
      },
      {
        title: "Navigation verstehen",
        body: "Die linke Seitenleiste ist in mehrere Bereiche unterteilt: Daten (Auswertung, Ranktracker, Linkprofil), Prozesse (SEO KVP, SEO Reifegrad, Briefings), Aufgaben (Kanban Board), Reporting und KI & Tools (SuperAgent, SEO Helper). Jeder Bereich hat eigene Unterpunkte, die du durch Klicken auf die jeweilige Kategorie aufklappen kannst.",
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    description: "Überblick über alle wichtigen KPIs",
    content: [
      {
        title: "KPI-Übersicht",
        body: "Das Dashboard zeigt dir die vier wichtigsten SEO-Kennzahlen auf einen Blick: Klicks, Impressionen, CTR (Click-Through-Rate) und die durchschnittliche Position. Jede Kennzahl zeigt auch die prozentuale Veränderung im Vergleich zum vorherigen Zeitraum.",
        link: "/",
        linkLabel: "Zum Dashboard",
      },
      {
        title: "Zeitraum wählen",
        body: "Mit dem Perioden-Selektor oben rechts kannst du den Auswertungszeitraum ändern: 7 Tage, 28 Tage, 3 Monate, 6 Monate oder 8 Monate. Die Vergleichswerte beziehen sich immer auf den gleich langen Zeitraum davor. Der maximale Zeitraum ist auf 8 Monate begrenzt, da die Google Search Console nur 16 Monate Daten bereitstellt und so ein vollständiger Vergleich mit dem vorherigen Zeitraum gewährleistet ist.",
      },
      {
        title: "Charts & Geräteverteilung",
        body: "Unterhalb der KPIs siehst du einen Linien-Chart für Klicks und Impressionen über die Zeit sowie ein Kreisdiagramm für die Geräteverteilung (Desktop, Mobile, Tablet). Im unteren Bereich findest du weitere Statistiken zu Benutzern, KVP-URLs, Reifegradmodellen, Briefings und Ranktracker-Keywords.",
      },
    ],
  },
  {
    id: "auswertung",
    title: "Auswertung",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    description: "Detaillierte GSC-Datenanalyse",
    content: [
      {
        title: "Übersicht",
        body: "Die Auswertungs-Übersicht zeigt dir eine Zusammenfassung deiner Google Search Console Daten. Du siehst die wichtigsten Metriken (Klicks, Impressionen, CTR, Position) und deren Entwicklung über den gewählten Zeitraum in übersichtlichen Charts.",
        link: "/auswertung",
        linkLabel: "Zur Auswertung",
      },
      {
        title: "Suchanfragen",
        body: "Unter Suchanfragen siehst du alle Keywords, für die deine Website in der Google-Suche erscheint. Die Tabelle zeigt Klicks, Impressionen, CTR und Position pro Keyword. Du kannst die Tabelle sortieren und nach bestimmten Keywords durchsuchen.",
        link: "/queries",
        linkLabel: "Zu Suchanfragen",
      },
      {
        title: "Seiten",
        body: "Die Seiten-Ansicht zeigt dir die Performance deiner einzelnen URLs. So erkennst du schnell, welche Seiten die meisten Klicks und Impressionen erhalten und wie sich deren Ranking entwickelt.",
        link: "/pages",
        linkLabel: "Zu Seiten",
      },
      {
        title: "Länder & Geräte",
        body: "Unter Länder siehst du, aus welchen Ländern deine Besucher kommen. Die Geräte-Ansicht zeigt die Verteilung zwischen Desktop, Mobile und Tablet. Beide Ansichten helfen dir, deine SEO-Strategie auf die wichtigsten Märkte und Gerätetypen auszurichten.",
        link: "/countries",
        linkLabel: "Zu Länder",
      },
    ],
  },
  {
    id: "ranktracker",
    title: "Ranktracker",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    description: "Keyword-Rankings verfolgen und analysieren",
    content: [
      {
        title: "Keywords tracken",
        body: "Der Ranktracker ermöglicht es dir, die Rankings bestimmter Keywords über die Zeit zu verfolgen. Du kannst Keywords hinzufügen, die für dein Unternehmen besonders relevant sind, und deren Positionsveränderungen in der Google-Suche beobachten.",
        link: "/ranktracker",
        linkLabel: "Zum Ranktracker",
      },
      {
        title: "Positionsverteilung",
        body: "Die Positionsverteilung zeigt dir, wie viele deiner Keywords in den Top 3, Top 10, Top 20, Top 50 oder darüber hinaus ranken. So behältst du den Überblick über die Gesamtperformance deiner SEO-Bemühungen.",
      },
    ],
  },
  {
    id: "linkprofil",
    title: "Linkprofil",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    description: "Backlinks analysieren und überwachen",
    content: [
      {
        title: "Backlink-Analyse",
        body: "Das Linkprofil zeigt dir alle eingehenden Links zu deiner Website, die von der Google Search Console erfasst werden. Du siehst, welche externen Seiten auf dich verlinken und welche deiner Seiten die meisten Backlinks erhalten.",
        link: "/linkprofil",
        linkLabel: "Zum Linkprofil",
      },
    ],
  },
  {
    id: "seo-kvp",
    title: "SEO KVP",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    description: "Kontinuierlicher Verbesserungsprozess für SEO",
    content: [
      {
        title: "Was ist der SEO KVP?",
        body: "Der SEO KVP (Kontinuierlicher Verbesserungsprozess) hilft dir, systematisch an der SEO-Optimierung deiner Website zu arbeiten. Du kannst URLs hinterlegen, die regelmäßig überprüft und optimiert werden sollen. Dabei wird der Fortschritt dokumentiert und nachverfolgt.",
        link: "/kvp",
        linkLabel: "Zum SEO KVP",
      },
      {
        title: "URLs verwalten",
        body: "Im KVP kannst du URLs hinzufügen, bearbeiten und ihren Optimierungsstatus verfolgen. Jede URL wird mit relevanten SEO-Metriken verknüpft, sodass du die Auswirkungen deiner Optimierungen direkt sehen kannst.",
      },
    ],
  },
  {
    id: "seo-reifegrad",
    title: "SEO Reifegrad",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: "SEO-Reifegrad deiner Organisation bewerten",
    content: [
      {
        title: "Reifegradmodelle",
        body: "Mit dem SEO-Reifegrad-Tool kannst du den aktuellen Stand der SEO-Reife deiner Organisation oder Abteilung bewerten. Du erstellst Modelle mit verschiedenen Checkpunkten und bewertest diese. So erkennst du Stärken und Verbesserungspotenziale.",
        link: "/seo-reifegrad",
        linkLabel: "Zum SEO Reifegrad",
      },
      {
        title: "Checkpunkte bewerten",
        body: "Jedes Reifegradmodell besteht aus mehreren Checkpunkten, die du auf einer Skala bewerten kannst. Die Ergebnisse werden visualisiert, sodass du auf einen Blick siehst, wo dein Unternehmen in Sachen SEO steht.",
      },
    ],
  },
  {
    id: "briefings",
    title: "Briefings",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: "Content-Briefings erstellen und verwalten",
    content: [
      {
        title: "Briefings erstellen",
        body: "Erstelle strukturierte Content-Briefings für Texter und Redakteure. Ein Briefing enthält alle relevanten Informationen wie Ziel-Keywords, Seitenstruktur, inhaltliche Anforderungen und SEO-Vorgaben.",
        link: "/briefings",
        linkLabel: "Zu Briefings",
      },
      {
        title: "Status-Management",
        body: "Jedes Briefing durchläuft verschiedene Status: Offen (erstellt, noch nicht bearbeitet), In Arbeit (wird gerade umgesetzt) und Abgeschlossen. So behältst du den Überblick über den Fortschritt aller Briefings.",
      },
      {
        title: "Briefing-Auswertung",
        body: "In der Auswertung siehst du Statistiken zu deinen Briefings: Wie viele sind offen, in Arbeit oder abgeschlossen? Welche Fortschritte wurden erzielt? Diese Übersicht hilft dir bei der Planung und Priorisierung.",
        link: "/briefings/auswertung",
        linkLabel: "Zur Briefing-Auswertung",
      },
    ],
  },
  {
    id: "tasks",
    title: "Kanban Board",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    description: "Aufgaben visuell organisieren und verwalten",
    content: [
      {
        title: "Aufgabenmanagement",
        body: "Das Kanban Board bietet dir eine visuelle Übersicht über alle SEO-Aufgaben. Du kannst Tasks erstellen, in Spalten organisieren (z.B. To-Do, In Arbeit, Erledigt) und per Drag & Drop verschieben. Ideal für die Zusammenarbeit im Team.",
        link: "/tasks",
        linkLabel: "Zum Kanban Board",
      },
      {
        title: "Tasks erstellen & bearbeiten",
        body: "Erstelle neue Tasks mit Titel, Beschreibung, Priorität und Deadline. Weise Tasks Teammitgliedern zu und verfolge den Fortschritt. Jeder Task kann kommentiert und mit zusätzlichen Details versehen werden.",
      },
    ],
  },
  {
    id: "reporting",
    title: "Reporting",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: "Umfassende SEO-Reports generieren",
    content: [
      {
        title: "Report-Übersicht",
        body: "Die Reporting-Übersicht bietet dir einen zentralen Zugang zu allen verfügbaren Report-Typen. Von hier aus kannst du verschiedene Reports erstellen, ansehen und exportieren.",
        link: "/reporting",
        linkLabel: "Zum Reporting",
      },
      {
        title: "Ranking Report",
        body: "Der Ranking Report zeigt dir detaillierte Informationen über die Ranking-Entwicklung deiner Keywords. Du siehst, welche Keywords gestiegen oder gefallen sind und kannst Trends über verschiedene Zeiträume analysieren.",
        link: "/reporting/ranking",
        linkLabel: "Zum Ranking Report",
      },
      {
        title: "Traffic Report",
        body: "Der Traffic Report analysiert den organischen Traffic deiner Website. Er zeigt dir Klicks, Impressionen und CTR-Entwicklung und hilft dir, den Erfolg deiner SEO-Maßnahmen zu messen.",
        link: "/reporting/traffic",
        linkLabel: "Zum Traffic Report",
      },
      {
        title: "KVP Report & Task Report",
        body: "Der KVP Report dokumentiert den Fortschritt deines kontinuierlichen Verbesserungsprozesses. Der Task Report gibt dir einen Überblick über alle erledigten und offenen Aufgaben im Reporting-Zeitraum.",
        link: "/reporting/kvp",
        linkLabel: "Zum KVP Report",
      },
    ],
  },
  {
    id: "superagent",
    title: "SuperAgent",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    description: "KI-gestützter SEO-Assistent",
    content: [
      {
        title: "Was ist der SuperAgent?",
        body: "Der SuperAgent ist ein KI-gestützter Assistent, der dir bei komplexen SEO-Aufgaben hilft. Du kannst ihm Fragen stellen, Analysen anfragen oder Aufgaben delegieren. Er nutzt die Daten aus deinem Dashboard, um kontextbezogene Empfehlungen zu geben.",
        link: "/superagent",
        linkLabel: "Zum SuperAgent",
      },
    ],
  },
  {
    id: "seo-helper",
    title: "SEO Helper",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    description: "Sammlung nützlicher SEO-Tools",
    content: [
      {
        title: "Tool-Übersicht",
        body: "Der SEO Helper bietet dir eine Sammlung spezialisierter Tools für verschiedene SEO-Aufgaben. Alle Tools sind über die SEO Helper Hauptseite erreichbar.",
        link: "/seo-helper",
        linkLabel: "Zum SEO Helper",
      },
      {
        title: "AI Summarizer",
        body: "Der AI Summarizer fasst Texte und Webseiten automatisch zusammen. Ideal, um schnell den Inhalt von Wettbewerber-Seiten zu erfassen oder lange Texte auf die Kernaussagen zu reduzieren.",
        link: "/seo-helper/ai-summarizer",
        linkLabel: "Zum AI Summarizer",
      },
      {
        title: "Content Analyzer",
        body: "Analysiere die Qualität und SEO-Tauglichkeit deiner Inhalte. Der Content Analyzer bewertet Texte nach Kriterien wie Lesbarkeit, Keyword-Dichte, Struktur und gibt Verbesserungsvorschläge.",
        link: "/seo-helper/content-analyzer",
        linkLabel: "Zum Content Analyzer",
      },
      {
        title: "Keyword Clustering",
        body: "Gruppiere eine Liste von Keywords automatisch in thematische Cluster. So erkennst du, welche Keywords auf einer gemeinsamen Seite behandelt werden können und welche eigene Seiten benötigen.",
        link: "/seo-helper/keyword-clustering",
        linkLabel: "Zum Keyword Clustering",
      },
      {
        title: "Weitere Tools",
        body: "Der SEO Helper enthält außerdem: SERP Preview (Vorschau deiner Google-Suchergebnisse), Title Generator (KI-generierte Seitentitel), FAQ Generator (automatische FAQ-Erstellung), Schema Generator (strukturierte Daten für Google) und den Benchmarker (Wettbewerbsvergleich).",
        link: "/seo-helper",
        linkLabel: "Alle Tools anzeigen",
      },
    ],
  },
  {
    id: "einstellungen",
    title: "Einstellungen & Verwaltung",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    description: "Account, Nutzer und Systemeinstellungen",
    content: [
      {
        title: "Einstellungen",
        body: "In den Einstellungen kannst du dein Profil bearbeiten, deinen Google Account verknüpfen/trennen und weitere persönliche Einstellungen vornehmen.",
        link: "/settings",
        linkLabel: "Zu den Einstellungen",
      },
      {
        title: "Nutzerverwaltung (Admin)",
        body: "Administratoren und Agentur-Nutzer haben Zugriff auf die Nutzerverwaltung. Hier können neue Nutzer eingeladen, Rollen zugewiesen und bestehende Zugänge verwaltet werden.",
        link: "/admin/users",
        linkLabel: "Zur Nutzerverwaltung",
      },
      {
        title: "Bugs & Features",
        body: "Hast du einen Bug gefunden oder eine Idee für ein neues Feature? Über die Tickets-Funktion kannst du Fehler melden und Feature-Wünsche einreichen. Das Entwicklerteam wird benachrichtigt und arbeitet an der Umsetzung.",
        link: "/tickets",
        linkLabel: "Zu Bugs & Features",
      },
    ],
  },
];

export default function DokumentationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return docSections;

    const query = searchQuery.toLowerCase();
    return docSections
      .map((section) => {
        const sectionMatches =
          section.title.toLowerCase().includes(query) ||
          section.description.toLowerCase().includes(query);
        const matchingArticles = section.content.filter(
          (article) =>
            article.title.toLowerCase().includes(query) ||
            article.body.toLowerCase().includes(query)
        );

        if (sectionMatches) return section;
        if (matchingArticles.length > 0) {
          return { ...section, content: matchingArticles };
        }
        return null;
      })
      .filter(Boolean) as DocSection[];
  }, [searchQuery]);

  const totalArticles = docSections.reduce(
    (sum, s) => sum + s.content.length,
    0
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dokumentation</h1>
        <p className="mt-2 text-slate-400">
          Willkommen in der Dokumentation des SEO Dashboards. Hier findest du
          alle Informationen zu den Funktionen und Features.
        </p>
      </div>

      {/* Suche */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg
            className="w-5 h-5 text-slate-400"
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
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Dokumentation durchsuchen..."
          className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Suchresultat-Info */}
      {searchQuery && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            {filteredSections.length === 0
              ? "Keine Ergebnisse gefunden"
              : `${filteredSections.length} Abschnitt${filteredSections.length !== 1 ? "e" : ""} mit Hinweisen gefunden`}
          </span>
        </div>
      )}

      {/* Schnellzugriff - nur ohne Suche */}
      {!searchQuery && (
        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl p-6 border border-blue-500/30">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-2 bg-blue-500/20 rounded-lg">
              <svg
                className="w-6 h-6 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">
                Schnellstart
              </h2>
              <p className="text-slate-300 text-sm mb-4">
                Neu hier? Starte mit diesen drei Schritten, um das Dashboard
                einzurichten:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    1
                  </span>
                  <span className="text-sm text-slate-200">
                    Google Account verknüpfen
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    2
                  </span>
                  <span className="text-sm text-slate-200">
                    Property auswählen
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    3
                  </span>
                  <span className="text-sm text-slate-200">
                    Dashboard erkunden
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistik-Bar */}
      {!searchQuery && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-white">
              {docSections.length}
            </p>
            <p className="text-sm text-slate-400">Kategorien</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-white">{totalArticles}</p>
            <p className="text-sm text-slate-400">Hinweise</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-white">8</p>
            <p className="text-sm text-slate-400">SEO Tools</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-white">5</p>
            <p className="text-sm text-slate-400">Report-Typen</p>
          </div>
        </div>
      )}

      {/* Inhaltsverzeichnis - nur ohne Suche */}
      {!searchQuery && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Inhaltsverzeichnis
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {docSections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  document
                    .getElementById(`section-${section.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex items-center gap-3 p-3 rounded-lg text-left text-sm hover:bg-slate-700 transition-colors group"
              >
                <span className="text-blue-400 group-hover:text-blue-300 flex-shrink-0">
                  {section.icon}
                </span>
                <div>
                  <p className="text-slate-200 font-medium group-hover:text-white">
                    {section.title}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {section.content.length} Hinweise
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sektionen */}
      <div className="space-y-6">
        {filteredSections.map((section) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className="scroll-mt-24"
          >
            <div
              className={`bg-slate-800 rounded-xl border transition-colors ${
                activeSection === section.id
                  ? "border-blue-500/50"
                  : "border-slate-700"
              }`}
            >
              {/* Section Header */}
              <button
                onClick={() =>
                  setActiveSection(
                    activeSection === section.id ? null : section.id
                  )
                }
                className="w-full flex items-center gap-4 p-6 text-left hover:bg-slate-700/30 rounded-xl transition-colors"
              >
                <div className="flex-shrink-0 p-2 bg-blue-500/10 rounded-lg text-blue-400">
                  {section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-white">
                    {section.title}
                  </h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {section.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 bg-slate-700 px-2 py-1 rounded-full">
                    {section.content.length} Hinweise
                  </span>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                      activeSection === section.id ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Section Content */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  activeSection === section.id || searchQuery
                    ? "max-h-[2000px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-6 pb-6 space-y-4">
                  <div className="border-t border-slate-700 pt-4"></div>
                  {section.content.map((article, index) => (
                    <div
                      key={index}
                      className="bg-slate-700/30 rounded-lg p-5"
                    >
                      <h3 className="text-base font-semibold text-white mb-2">
                        {article.title}
                      </h3>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {article.body}
                      </p>
                      {article.link && (
                        <Link
                          href={article.link}
                          className="inline-flex items-center gap-2 mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {article.linkLabel || "Mehr erfahren"}
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Hilfe */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-shrink-0 p-2 bg-emerald-500/10 rounded-lg">
            <svg
              className="w-6 h-6 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold">
              Noch Fragen?
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Falls du weitere Hilfe benötigst oder einen Fehler melden
              möchtest, nutze die Tickets-Funktion.
            </p>
          </div>
          <Link
            href="/tickets"
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
            Ticket erstellen
          </Link>
        </div>
      </div>
    </div>
  );
}
