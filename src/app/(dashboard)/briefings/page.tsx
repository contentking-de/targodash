"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { canEdit, hasFullAdminRights, isAgentur } from "@/lib/rbac";
import { getAuthenticatedBlobUrl } from "@/lib/blob-url";
import { StatCard } from "@/components/ui/StatCard";
import { jsPDF } from "jspdf";

// Kategorien - gleich wie bei KVP
const KEYWORD_CATEGORIES = [
  "Mortgages",
  "Accounts&Cards",
  "Investing",
  "Pension",
  "Digital Banking",
] as const;

interface Briefing {
  id: string;
  briefingNumber: number;
  title: string;
  briefingType: "new_content" | "edit_content" | "lexicon";
  category: string | null;
  contentAction: string;
  targetAudience: string | null;
  funnelStage: string | null;
  goals: string | null;
  focusKeyword: string | null;
  keywordCluster: string | null;
  topicCluster: string | null;
  searchIntent: string | null;
  url: string | null;
  benchmarkUrls: string | null;
  csArticle: string | null;
  titleTag: string | null;
  metaDescription: string | null;
  navTitle: string | null;
  h1: string | null;
  mainParagraph: string | null;
  primaryCta: string | null;
  secondaryCta: string | null;
  inboundCta: string | null;
  keywordsetLongtail: string | null;
  topicclusterContent: string | null;
  bodyContent: string | null;
  internalLinks: string | null;
  missingTopics: string | null;
  faqs: string | null;
  notes: string | null;
  titleEn: string | null;
  titleFr: string | null;
  titleIt: string | null;
  // Lexikon-spezifische Felder
  lexiconDefinition: string | null;
  lexiconSynonyms: string | null;
  lexiconRelated: string | null;
  // Grafische Darstellung
  diagramUrl: string | null;
  // Deadline
  deadline: string | null;
  status: "ordered" | "in_progress" | "in_review" | "completed";
  requester: { id: string; name: string | null; email: string };
  assignee: { id: string; name: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

type BriefingType = "new_content" | "edit_content" | "lexicon";

// Status-Konfiguration für Timeline
const BRIEFING_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  ordered: { label: "Bestellt", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30", dotColor: "bg-blue-500" },
  in_progress: { label: "In Bearbeitung", color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-100 dark:bg-yellow-900/30", dotColor: "bg-yellow-500" },
  in_review: { label: "In Prüfung", color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30", dotColor: "bg-purple-500" },
  completed: { label: "Fertig", color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30", dotColor: "bg-green-500" },
};

const BRIEFING_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  new_content: { label: "Neu", icon: "+", color: "text-emerald-600 dark:text-emerald-400" },
  edit_content: { label: "Edit", icon: "~", color: "text-orange-600 dark:text-orange-400" },
  lexicon: { label: "Lex", icon: "B", color: "text-purple-600 dark:text-purple-400" },
};

const TIMELINE_CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  "Mortgages": { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-l-blue-500", text: "text-blue-700 dark:text-blue-300", bar: "bg-blue-400/80 dark:bg-blue-500/60" },
  "Accounts&Cards": { bg: "bg-green-50 dark:bg-green-900/20", border: "border-l-green-500", text: "text-green-700 dark:text-green-300", bar: "bg-green-400/80 dark:bg-green-500/60" },
  "Investing": { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-l-purple-500", text: "text-purple-700 dark:text-purple-300", bar: "bg-purple-400/80 dark:bg-purple-500/60" },
  "Pension": { bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-l-orange-500", text: "text-orange-700 dark:text-orange-300", bar: "bg-orange-400/80 dark:bg-orange-500/60" },
  "Digital Banking": { bg: "bg-cyan-50 dark:bg-cyan-900/20", border: "border-l-cyan-500", text: "text-cyan-700 dark:text-cyan-300", bar: "bg-cyan-400/80 dark:bg-cyan-500/60" },
};

const DEFAULT_CATEGORY_COLORS = { bg: "bg-slate-50 dark:bg-slate-800/50", border: "border-l-slate-400", text: "text-slate-700 dark:text-slate-300", bar: "bg-slate-400/80 dark:bg-slate-500/60" };

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function BriefingTimelineView({
  briefings,
  onBriefingClick,
  filterStatus,
  filterCategory,
}: {
  briefings: Briefing[];
  onBriefingClick: (briefing: Briefing) => void;
  filterStatus: string;
  filterCategory: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Zeitraum berechnen: 2 Wochen Vergangenheit bis 10 Wochen Zukunft
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 14);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 70);

  // Wochen generieren
  const weeks: { start: Date; end: Date; label: string; isCurrentWeek: boolean }[] = [];
  const weekCursor = new Date(startDate);
  weekCursor.setDate(weekCursor.getDate() - weekCursor.getDay() + 1); // Auf Montag setzen

  while (weekCursor < endDate) {
    const weekEnd = new Date(weekCursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const isCurrentWeek = today >= weekCursor && today <= weekEnd;

    weeks.push({
      start: new Date(weekCursor),
      end: weekEnd,
      label: `KW ${getWeekNumber(weekCursor)}`,
      isCurrentWeek,
    });

    weekCursor.setDate(weekCursor.getDate() + 7);
  }

  const totalMs = endDate.getTime() - startDate.getTime();

  // Position auf der Timeline in Prozent
  const getPositionPercent = (date: Date) => {
    return Math.max(0, Math.min(100, ((date.getTime() - startDate.getTime()) / totalMs) * 100));
  };

  // Heute-Position
  const todayPercent = getPositionPercent(today);

  // Briefings nach Status-Workflow sortieren
  const statusOrder: Record<string, number> = { ordered: 0, in_progress: 1, in_review: 2, completed: 3 };

  const sortedBriefings = [...briefings].sort((a, b) => {
    // Zuerst nach Status
    const statusDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;
    // Dann nach Deadline (früheste zuerst)
    if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    // Dann nach Erstelldatum
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Gruppierung nach Status
  const groupedByStatus = sortedBriefings.reduce((acc, b) => {
    if (!acc[b.status]) acc[b.status] = [];
    acc[b.status].push(b);
    return acc;
  }, {} as Record<string, Briefing[]>);

  const statusKeys = ["ordered", "in_progress", "in_review", "completed"];
  const activeStatuses = statusKeys.filter((s) => groupedByStatus[s]?.length);

  if (briefings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-700">
        <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
          Keine Briefings vorhanden
        </h3>
        <p className="text-slate-500 dark:text-slate-400">
          Erstelle ein neues Briefing, um es in der Timeline zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Timeline Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 bg-white dark:bg-slate-800">
        <div className="flex">
          {/* Linke Spalte Header */}
          <div className="w-64 flex-shrink-0 p-3 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Briefing</span>
          </div>
          {/* Wochen Header */}
          <div className="flex-1 flex relative overflow-hidden">
            {weeks.map((week, idx) => (
              <div
                key={idx}
                className={`flex-1 min-w-[80px] p-2 text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0 ${
                  week.isCurrentWeek ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                }`}
              >
                <span className={`text-xs font-semibold ${week.isCurrentWeek ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"}`}>
                  {week.label}
                </span>
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  {week.start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Body */}
      <div className="overflow-x-auto">
        {activeStatuses.map((statusKey) => {
          const statusConfig = BRIEFING_STATUS_CONFIG[statusKey];
          const items = groupedByStatus[statusKey];
          if (!items || items.length === 0) return null;

          return (
            <div key={statusKey}>
              {/* Status-Gruppen-Header */}
              <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30">
                <div className="w-64 flex-shrink-0 px-3 py-2 border-r border-slate-200 dark:border-slate-700 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.dotColor}`}></span>
                  <span className={`text-sm font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 relative min-h-[32px]">
                  {/* Heute-Linie im Header */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: `${todayPercent}%` }}
                  />
                  {/* Wochen-Grid im Header */}
                  <div className="absolute inset-0 flex">
                    {weeks.map((week, idx) => (
                      <div key={idx} className={`flex-1 min-w-[80px] border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${
                        week.isCurrentWeek ? "bg-blue-50/30 dark:bg-blue-900/5" : ""
                      }`} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Briefing-Zeilen */}
              {items.map((briefing) => {
                const created = new Date(briefing.createdAt);
                const deadline = briefing.deadline ? new Date(briefing.deadline) : null;
                const isOverdue = deadline && deadline < today && briefing.status !== "completed";
                const catColors = TIMELINE_CATEGORY_COLORS[briefing.category || ""] || DEFAULT_CATEGORY_COLORS;
                const typeConfig = BRIEFING_TYPE_CONFIG[briefing.briefingType] || { label: "?", icon: "?", color: "text-slate-500" };

                // Balken: von createdAt bis deadline
                const barStart = getPositionPercent(created);
                const barEnd = deadline ? getPositionPercent(deadline) : barStart + 3;
                const barWidth = Math.max(2.5, barEnd - barStart);

                // Status-Fortschrittsanzeige innerhalb des Balkens
                const progressPercent = briefing.status === "completed" ? 100
                  : briefing.status === "in_review" ? 80
                  : briefing.status === "in_progress" ? 40
                  : 10;

                return (
                  <div
                    key={briefing.id}
                    className="flex border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors group"
                  >
                    {/* Linke Info-Spalte */}
                    <div
                      className={`w-64 flex-shrink-0 p-2.5 border-r border-slate-200 dark:border-slate-700 cursor-pointer border-l-4 ${catColors.border}`}
                      onClick={() => onBriefingClick(briefing)}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs text-slate-400 dark:text-slate-500">#{briefing.briefingNumber}</span>
                        <span className={`text-xs font-medium ${typeConfig.color}`}>{typeConfig.label}</span>
                        {briefing.category && (
                          <span className={`text-xs px-1 py-0.5 rounded ${catColors.bg} ${catColors.text}`}>
                            {briefing.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {briefing.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {briefing.requester.name || briefing.requester.email}
                        </span>
                        {briefing.assignee && (
                          <>
                            <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {briefing.assignee.name || briefing.assignee.email}
                            </span>
                          </>
                        )}
                      </div>
                      {isOverdue && (
                        <div className="flex items-center gap-1 mt-1">
                          <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span className="text-xs text-red-500 font-medium">Überfällig</span>
                        </div>
                      )}
                    </div>

                    {/* Timeline-Bereich */}
                    <div className="flex-1 relative py-2 min-h-[60px]">
                      {/* Heute-Linie */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500/30 z-[1]"
                        style={{ left: `${todayPercent}%` }}
                      />
                      {/* Wochen-Grid */}
                      <div className="absolute inset-0 flex">
                        {weeks.map((week, idx) => (
                          <div key={idx} className={`flex-1 min-w-[80px] border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${
                            week.isCurrentWeek ? "bg-blue-50/20 dark:bg-blue-900/5" : ""
                          }`} />
                        ))}
                      </div>

                      {/* Briefing-Balken */}
                      <div
                        className={`absolute top-2.5 cursor-pointer rounded-md overflow-hidden transition-all hover:shadow-md z-[2] group/bar ${
                          isOverdue ? "ring-2 ring-red-400/50" : ""
                        }`}
                        style={{
                          left: `${barStart}%`,
                          width: `${barWidth}%`,
                          minWidth: "70px",
                          height: "calc(100% - 20px)",
                        }}
                        onClick={() => onBriefingClick(briefing)}
                        title={`${briefing.title}\nErstellt: ${created.toLocaleDateString("de-DE")}${deadline ? `\nDeadline: ${deadline.toLocaleDateString("de-DE")}` : ""}\nStatus: ${statusConfig.label}`}
                      >
                        {/* Hintergrund-Balken */}
                        <div className={`absolute inset-0 ${catColors.bar} opacity-30`} />
                        {/* Fortschritts-Balken */}
                        <div
                          className={`absolute inset-y-0 left-0 ${catColors.bar} transition-all`}
                          style={{ width: `${progressPercent}%` }}
                        />
                        {/* Inhalt des Balkens */}
                        <div className="relative h-full flex items-center px-2 gap-1.5 overflow-hidden">
                          <span className="text-xs font-medium text-white truncate drop-shadow-sm">
                            {briefing.title}
                          </span>
                          {deadline && (
                            <span className={`text-xs shrink-0 px-1 py-0.5 rounded ${
                              isOverdue
                                ? "bg-red-600 text-white"
                                : "bg-white/20 text-white"
                            }`}>
                              {deadline.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Erstelldatum-Marker */}
                      <div
                        className="absolute bottom-1 z-[3]"
                        style={{ left: `${barStart}%` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" title={`Erstellt: ${created.toLocaleDateString("de-DE")}`} />
                      </div>

                      {/* Deadline-Marker */}
                      {deadline && (
                        <div
                          className="absolute bottom-1 z-[3]"
                          style={{ left: `${getPositionPercent(deadline)}%` }}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${isOverdue ? "bg-red-500" : "bg-green-500"}`} title={`Deadline: ${deadline.toLocaleDateString("de-DE")}`} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legende */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-400">Status:</span>
          {statusKeys.map((key) => {
            const cfg = BRIEFING_STATUS_CONFIG[key];
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor}`} />
                <span className="text-slate-600 dark:text-slate-400">{cfg.label}</span>
              </div>
            );
          })}
          <span className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
          <span className="font-medium text-slate-600 dark:text-slate-400">Kategorien:</span>
          {Object.entries(TIMELINE_CATEGORY_COLORS).map(([cat, colors]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <div className={`w-3 h-2 rounded-sm ${colors.bar}`} />
              <span className="text-slate-600 dark:text-slate-400">{cat}</span>
            </div>
          ))}
          <span className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-red-500" />
            <span className="text-slate-600 dark:text-slate-400">Heute</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BriefingsPage() {
  const { data: session } = useSession();
  const canEditData = canEdit(session?.user?.role);
  const isAdmin = hasFullAdminRights(session?.user?.role);
  const isAgenturUser = isAgentur(session?.user?.role); // NUR Agentur, nicht Superadmin
  
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedBriefing, setSelectedBriefing] = useState<Briefing | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiLoadingField, setAiLoadingField] = useState<string | null>(null);
  const [diagramLoading, setDiagramLoading] = useState(false);

  // Form states für neue Bestellung
  const [newBriefingType, setNewBriefingType] = useState<BriefingType>("new_content");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newContentAction, setNewContentAction] = useState<string>("edit");
  const [newTargetAudience, setNewTargetAudience] = useState("");
  const [newFunnelStage, setNewFunnelStage] = useState<string>("");
  const [newGoals, setNewGoals] = useState("");
  const [newFocusKeyword, setNewFocusKeyword] = useState("");
  const [newKeywordCluster, setNewKeywordCluster] = useState("");
  const [newTopicCluster, setNewTopicCluster] = useState("");
  const [newSearchIntent, setNewSearchIntent] = useState<string>("");
  const [newUrl, setNewUrl] = useState("");
  const [newBenchmarkUrls, setNewBenchmarkUrls] = useState("");
  const [newCsArticle, setNewCsArticle] = useState("");
  // Lexikon-spezifische Felder
  const [newLexiconDefinition, setNewLexiconDefinition] = useState("");
  const [newLexiconSynonyms, setNewLexiconSynonyms] = useState("");
  const [newLexiconRelated, setNewLexiconRelated] = useState("");
  // Filter
  const [filterCategory, setFilterCategory] = useState<string>("all");
  // View Mode
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");

  useEffect(() => {
    fetchBriefings();
  }, []);

  const fetchBriefings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/briefings");
      const data = await response.json();
      setBriefings(data.briefings || []);
    } catch (error) {
      console.error("Error fetching briefings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createBriefing = async () => {
    if (!newTitle.trim()) return;
    
    // Bei "Content überarbeiten" ist die URL Pflicht
    if (newBriefingType === "edit_content" && !newUrl.trim()) {
      alert("Bei Content-Überarbeitung ist die URL ein Pflichtfeld");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          briefingType: newBriefingType,
          category: newCategory || null,
          contentAction: newContentAction,
          targetAudience: newTargetAudience.trim() || null,
          funnelStage: newFunnelStage || null,
          goals: newGoals.trim() || null,
          focusKeyword: newFocusKeyword.trim() || null,
          keywordCluster: newKeywordCluster.trim() || null,
          topicCluster: newTopicCluster.trim() || null,
          searchIntent: newSearchIntent || null,
          url: newUrl.trim() || null,
          benchmarkUrls: newBenchmarkUrls.trim() || null,
          csArticle: newCsArticle.trim() || null,
          // Lexikon-Felder
          lexiconDefinition: newLexiconDefinition.trim() || null,
          lexiconSynonyms: newLexiconSynonyms.trim() || null,
          lexiconRelated: newLexiconRelated.trim() || null,
        }),
      });

      const data = await response.json();
      if (data.briefing) {
        setBriefings([data.briefing, ...briefings]);
        resetForm();
        setShowNewForm(false);
      } else {
        alert(data.error || "Fehler beim Erstellen des Briefings");
      }
    } catch (error) {
      console.error("Error creating briefing:", error);
      alert("Fehler beim Erstellen des Briefings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewBriefingType("new_content");
    setNewCategory("");
    setNewTitle("");
    setNewContentAction("edit");
    setNewTargetAudience("");
    setNewFunnelStage("");
    setNewGoals("");
    setNewFocusKeyword("");
    setNewKeywordCluster("");
    setNewTopicCluster("");
    setNewSearchIntent("");
    setNewUrl("");
    setNewBenchmarkUrls("");
    setNewCsArticle("");
    setNewLexiconDefinition("");
    setNewLexiconSynonyms("");
    setNewLexiconRelated("");
  };

  const updateBriefing = async (briefingId: string, updates: Partial<Briefing>) => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/briefings/${briefingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.briefing) {
        setBriefings(briefings.map((b) => (b.id === briefingId ? data.briefing : b)));
        setSelectedBriefing(data.briefing);
      }
    } catch (error) {
      console.error("Error updating briefing:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBriefing = async (briefingId: string) => {
    if (!confirm("Briefing wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/briefings/${briefingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setBriefings(briefings.filter((b) => b.id !== briefingId));
        if (selectedBriefing?.id === briefingId) {
          setSelectedBriefing(null);
        }
      }
    } catch (error) {
      console.error("Error deleting briefing:", error);
    }
  };

  // KI-Vorschlag für ein Feld generieren (nur für Agentur-User)
  const generateAiSuggestion = async (briefingId: string, field: string) => {
    if (!isAgenturUser) return;
    
    try {
      setAiLoadingField(field);
      const response = await fetch(`/api/briefings/${briefingId}/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });

      const data = await response.json();
      if (data.suggestion) {
        // Vorschlag direkt ins Feld übernehmen
        await updateBriefing(briefingId, { [field]: data.suggestion });
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error generating AI suggestion:", error);
      alert("Fehler bei der KI-Generierung");
    } finally {
      setAiLoadingField(null);
    }
  };

  // Diagramm generieren (nur für Agentur-User)
  const generateDiagram = async (briefingId: string) => {
    if (!isAgenturUser) return;
    
    try {
      setDiagramLoading(true);
      const response = await fetch(`/api/briefings/${briefingId}/generate-diagram`, {
        method: "POST",
      });

      const data = await response.json();
      if (data.briefing) {
        setBriefings(briefings.map((b) => (b.id === briefingId ? data.briefing : b)));
        setSelectedBriefing(data.briefing);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error generating diagram:", error);
      alert("Fehler bei der Diagramm-Generierung");
    } finally {
      setDiagramLoading(false);
    }
  };

  // Diagramm manuell hochladen (nur für Agentur-User)
  const uploadDiagram = async (briefingId: string, file: File) => {
    if (!isAgenturUser) return;
    
    try {
      setDiagramLoading(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/briefings/${briefingId}/generate-diagram`, {
        method: "PUT",
        body: formData,
      });

      const data = await response.json();
      if (data.briefing) {
        setBriefings(briefings.map((b) => (b.id === briefingId ? data.briefing : b)));
        setSelectedBriefing(data.briefing);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error uploading diagram:", error);
      alert("Fehler beim Hochladen des Diagramms");
    } finally {
      setDiagramLoading(false);
    }
  };

  // Diagramm löschen (nur für Agentur-User)
  const deleteDiagram = async (briefingId: string) => {
    if (!isAgenturUser) return;
    if (!confirm("Diagramm wirklich löschen?")) return;
    
    try {
      setDiagramLoading(true);
      const response = await fetch(`/api/briefings/${briefingId}/generate-diagram`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.briefing) {
        setBriefings(briefings.map((b) => (b.id === briefingId ? data.briefing : b)));
        setSelectedBriefing(data.briefing);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error deleting diagram:", error);
      alert("Fehler beim Löschen des Diagramms");
    } finally {
      setDiagramLoading(false);
    }
  };

  // PDF-Download für fertiges Briefing
  const downloadBriefingPdf = async (briefing: Briefing) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = 20;

    // Helper: Markdown-Syntax für PDF bereinigen und formatieren
    const cleanMarkdownForPdf = (text: string): string => {
      return text
        // Emojis durch Text ersetzen (jsPDF kann keine Emojis)
        .replace(/🔴/g, "[HOCH]")
        .replace(/🟡/g, "[MITTEL]")
        .replace(/🟢/g, "[NIEDRIG]")
        .replace(/✓/g, "[OK]")
        .replace(/✗/g, "[X]")
        .replace(/⚠️/g, "[!]")
        .replace(/←/g, "->")
        // Backticks entfernen
        .replace(/`/g, "")
        // IST/SOLL Format beibehalten aber lesbarer machen
        .replace(/^IST:\s*/gm, "IST: ")
        .replace(/^SOLL:\s*/gm, "SOLL: ")
        // Markdown Überschriften in lesbare Form umwandeln
        .replace(/^#{1,4}\s*H(\d):\s*/gm, "H$1: ")  // ## H2: -> H2:
        .replace(/^#{1,4}\s*/gm, "")                 // Restliche # entfernen
        // Markdown-Marker entfernen
        .replace(/!\s*•\s*/g, " - ")                 // !• -> -
        .replace(/\s*(NEU|BEHALTEN|ÄNDERN)\s*$/gm, " [$1]") // NEU -> [NEU]
        // Aufzählungszeichen vereinheitlichen
        .replace(/^[-*]\s+/gm, "- ")
        .replace(/•/g, "-")
        // Mehrfache Leerzeilen reduzieren
        .replace(/\n{3,}/g, "\n\n")
        // Trim
        .trim();
    };

    const cardPadding = 6;
    const cardMargin = margin - 3;
    const cardWidth = contentWidth + 6;
    const cardRadius = 3;

    // Helper: Card-Hintergrund zeichnen
    const drawCardBackground = (cardY: number, cardHeight: number, color: [number, number, number] = [248, 250, 252]) => {
      doc.setFillColor(color[0], color[1], color[2]);
      doc.setDrawColor(226, 232, 240); // Slate-200 Border
      doc.roundedRect(cardMargin, cardY, cardWidth, cardHeight, cardRadius, cardRadius, "FD");
    };

    // Helper: Section-Header mit farbigem Akzent
    const addSectionHeader = (title: string, accentColor: [number, number, number] = [37, 99, 235]) => {
      y += 14; // Mehr Abstand vor Section-Header
      if (y > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 20;
      }
      
      // Farbiger Akzent-Balken links
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.roundedRect(cardMargin, y - 4, 3, 12, 1.5, 1.5, "F");
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text(title, cardMargin + 8, y + 3);
      y += 14;
    };

    // Helper: Einzelnes Feld in einer Card (Label + Value)
    const addField = (label: string, value: string | null, isInCard: boolean = true) => {
      if (!value) return;
      
      const cleanedValue = cleanMarkdownForPdf(value);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const innerWidth = isInCard ? contentWidth - 4 : contentWidth;
      const lines = doc.splitTextToSize(cleanedValue, innerWidth);
      const lineHeight = 4.5;
      const fieldHeight = 6 + lines.length * lineHeight;
      
      // Seitenumbruch prüfen
      if (y + fieldHeight > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
      
      // Label
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139); // Slate-500
      const labelX = isInCard ? cardMargin + cardPadding : margin;
      doc.text(label.toUpperCase(), labelX, y);
      y += 4;
      
      // Value
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59); // Slate-800
      const valueX = isInCard ? cardMargin + cardPadding : margin;
      
      for (let i = 0; i < lines.length; i++) {
        if (y + lineHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(lines[i], valueX, y);
        y += lineHeight;
      }
      y += 4;
    };

    // Helper: Card mit mehreren Feldern
    const addCard = (fields: Array<{label: string, value: string | null}>) => {
      // Felder filtern (nur mit Wert)
      const validFields = fields.filter(f => f.value);
      if (validFields.length === 0) return;
      
      // Höhe berechnen
      doc.setFontSize(9);
      let totalHeight = cardPadding * 2;
      for (const field of validFields) {
        const cleanedValue = cleanMarkdownForPdf(field.value!);
        const lines = doc.splitTextToSize(cleanedValue, contentWidth - 4);
        totalHeight += 10 + lines.length * 4.5;
      }
      
      // Seitenumbruch wenn Card nicht passt
      if (y + totalHeight > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
      
      const cardStartY = y - 2;
      
      // Card-Hintergrund zeichnen
      drawCardBackground(cardStartY, totalHeight);
      
      y += cardPadding - 2;
      
      // Felder hinzufügen
      for (const field of validFields) {
        addField(field.label, field.value, true);
      }
      
      y += 6; // Mehr Abstand nach Card
    };

    // Helper: Einzelne kleine Card für ein Feld
    const addSingleFieldCard = (label: string, value: string | null) => {
      if (!value) return;
      
      const cleanedValue = cleanMarkdownForPdf(value);
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(cleanedValue, contentWidth - 4);
      const cardHeight = cardPadding * 2 + 10 + lines.length * 4.5;
      
      if (y + cardHeight > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
      
      const cardStartY = y - 2;
      drawCardBackground(cardStartY, cardHeight);
      y += cardPadding - 2;
      addField(label, value, true);
      y += 6; // Mehr Abstand nach Card
    };

    // Header (erweitert für mehr Infos)
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 52, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Content Briefing", margin, 14);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`#${briefing.briefingNumber} - ${briefing.title}`, margin, 24);
    
    // Meta-Infos im Header
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const besteller = briefing.requester.name || briefing.requester.email;
    const ersteller = briefing.assignee ? (briefing.assignee.name || briefing.assignee.email) : "Noch nicht zugewiesen";
    const deadlineText = briefing.deadline ? ` | Deadline: ${formatDate(briefing.deadline)}` : "";
    doc.text(`Erstellt: ${formatDate(briefing.createdAt)} | Status: ${getStatusLabel(briefing.status)}${deadlineText}`, margin, 34);
    doc.text(`Besteller: ${besteller} | Ersteller: ${ersteller}`, margin, 42);
    
    // Briefing-Typ Badge rechts im Header
    doc.setFontSize(8);
    const typeLabel = getBriefingTypeLabel(briefing.briefingType);
    const typeLabelWidth = doc.getTextWidth(typeLabel) + 8;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - margin - typeLabelWidth, 10, typeLabelWidth, 7, 2, 2, "F");
    doc.setTextColor(37, 99, 235);
    doc.text(typeLabel, pageWidth - margin - typeLabelWidth + 4, 15);
    
    y = 62;
    doc.setTextColor(0, 0, 0);

    // === BESTELLDATEN ===
    addSectionHeader("Bestelldaten", [37, 99, 235]); // Blau
    
    addSingleFieldCard("Kategorie", briefing.category);
    addSingleFieldCard("Ausgangslage", getContentActionLabel(briefing.contentAction));
    addSingleFieldCard("Zielgruppe", briefing.targetAudience);
    addSingleFieldCard("Funnel-Stufe", getFunnelStageLabel(briefing.funnelStage));
    addSingleFieldCard("Search Intent", getSearchIntentLabel(briefing.searchIntent));
    addSingleFieldCard("Ziele / KPIs", briefing.goals);
    addSingleFieldCard("Fokus-Keyword", briefing.focusKeyword);
    addSingleFieldCard("URL", briefing.url);
    addSingleFieldCard("Keyword-Cluster", briefing.keywordCluster);
    addSingleFieldCard("Topic-Cluster", briefing.topicCluster);
    addSingleFieldCard("Benchmark URLs", briefing.benchmarkUrls);
    addSingleFieldCard("CS Artikel", briefing.csArticle);

    // === CONTENT-AUFBAU ===
    addSectionHeader("Content-Aufbau", [16, 185, 129]); // Grün
    
    addSingleFieldCard("Title Tag", briefing.titleTag);
    addSingleFieldCard("Meta Description", briefing.metaDescription);
    addSingleFieldCard("Navigationstitel", briefing.navTitle);
    addSingleFieldCard("H1", briefing.h1);
    addSingleFieldCard("Hauptparagraf", briefing.mainParagraph);
    addSingleFieldCard("Primary CTA", briefing.primaryCta);
    addSingleFieldCard("Secondary CTA", briefing.secondaryCta);
    addSingleFieldCard("Inbound CTA", briefing.inboundCta);
    addSingleFieldCard("Keywordset / Longtail", briefing.keywordsetLongtail);
    addSingleFieldCard("Topiccluster", briefing.topicclusterContent);
    addSingleFieldCard("Fliesstext / Struktur", briefing.bodyContent);
    
    // Grafische Darstellung als Bild einfügen (falls vorhanden)
    if (briefing.diagramUrl) {
      y += 8;
      
      // Label
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("GRAFISCHE DARSTELLUNG", cardMargin + cardPadding, y);
      y += 5;
      
      // Bild laden und einfügen
      try {
        const imgResponse = await fetch(getAuthenticatedBlobUrl(briefing.diagramUrl));
        const imgBlob = await imgResponse.blob();
        const imgBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imgBlob);
        });
        
        // Bildgröße berechnen
        const img = new Image();
        img.src = imgBase64;
        await new Promise((resolve) => { img.onload = resolve; });
        
        const maxWidth = contentWidth - 8;
        const maxHeight = 75;
        let imgWidth = maxWidth;
        let imgHeight = (img.height / img.width) * imgWidth;
        
        if (imgHeight > maxHeight) {
          imgHeight = maxHeight;
          imgWidth = (img.width / img.height) * imgHeight;
        }
        
        // Card mit Bild
        const imageCardHeight = imgHeight + cardPadding * 2 + 12;
        if (y + imageCardHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
        
        const cardStartY = y - 2;
        drawCardBackground(cardStartY, imageCardHeight, [255, 255, 255]);
        
        // Bild zentriert einfügen
        const imgX = cardMargin + (cardWidth - imgWidth) / 2;
        doc.addImage(imgBase64, "PNG", imgX, y + 2, imgWidth, imgHeight);
        y += imgHeight + 6;
        
        // Link unter dem Bild
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(59, 130, 246);
        doc.textWithLink("Schaubild in voller Auflösung ansehen", cardMargin + cardPadding, y, { url: getAuthenticatedBlobUrl(briefing.diagramUrl) });
        y += cardPadding + 4;
      } catch (imgError) {
        console.error("Fehler beim Laden des Diagramms für PDF:", imgError);
        y += 5;
      }
      doc.setTextColor(30, 41, 59);
    }
    
    // === WEITERE INHALTE ===
    addSectionHeader("Weitere Inhalte", [245, 158, 11]); // Amber/Orange
    
    addSingleFieldCard("Interne Verlinkungen", briefing.internalLinks);
    
    if (briefing.briefingType === "edit_content") {
      addSingleFieldCard("Missing Topics", briefing.missingTopics);
    }
    
    addSingleFieldCard("FAQs", briefing.faqs);
    addSingleFieldCard("Bemerkungen", briefing.notes);

    // === MEHRSPRACHIGKEIT ===
    if (briefing.titleEn || briefing.titleFr || briefing.titleIt) {
      addSectionHeader("Weitere Sprachen", [139, 92, 246]); // Violett
      
      addSingleFieldCard("EN Titel", briefing.titleEn);
      addSingleFieldCard("FR Titel", briefing.titleFr);
      addSingleFieldCard("IT Titel", briefing.titleIt);
    }

    // Download
    doc.save(`Briefing-${briefing.briefingNumber}-${briefing.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
  };

  const getContentActionLabel = (action: string) => {
    switch (action) {
      case "edit":
        return "Überarbeiten";
      case "merge":
        return "Mergen";
      case "new":
        return "Neu erstellen";
      default:
        return action;
    }
  };

  const getFunnelStageLabel = (stage: string | null) => {
    if (!stage) return "-";
    switch (stage) {
      case "attention":
        return "Attention";
      case "interest":
        return "Interest";
      case "desire":
        return "Desire";
      case "action":
        return "Action";
      default:
        return stage;
    }
  };

  const getSearchIntentLabel = (intent: string | null) => {
    if (!intent) return "-";
    switch (intent) {
      case "informational":
        return "Informational";
      case "navigational":
        return "Navigational";
      case "transactional":
        return "Transactional";
      case "commercial":
        return "Commercial";
      default:
        return intent;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ordered":
        return "Bestellt";
      case "in_progress":
        return "In Bearbeitung";
      case "in_review":
        return "In Prüfung";
      case "completed":
        return "Fertig";
      default:
        return status;
    }
  };

  const getBriefingTypeLabel = (type: string) => {
    switch (type) {
      case "new_content":
        return "Neuer Content";
      case "edit_content":
        return "Content überarbeiten";
      case "lexicon":
        return "Lexikon Content";
      default:
        return type;
    }
  };

  const getBriefingTypeColor = (type: string) => {
    switch (type) {
      case "new_content":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "edit_content":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "lexicon":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ordered":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "in_progress":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "in_review":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "completed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const filteredBriefings = briefings.filter((briefing) => {
    if (filterStatus !== "all" && briefing.status !== filterStatus) return false;
    if (filterCategory !== "all") {
      if (filterCategory === "__no_category__" && briefing.category) return false;
      if (filterCategory !== "__no_category__" && briefing.category !== filterCategory) return false;
    }
    return true;
  });

  const briefingStats = {
    total: briefings.length,
    ordered: briefings.filter((b) => b.status === "ordered").length,
    inProgress: briefings.filter((b) => b.status === "in_progress").length,
    inReview: briefings.filter((b) => b.status === "in_review").length,
    completed: briefings.filter((b) => b.status === "completed").length,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Briefings</h1>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Briefings</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {viewMode === "timeline"
              ? "Zeitliche Übersicht aller Briefings"
              : isAdmin
              ? "Alle Briefing-Bestellungen verwalten"
              : "SEO Content Briefings bestellen"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Liste
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                viewMode === "timeline"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Timeline
            </button>
          </div>
          <a
            href="/briefing-vorlage.docx"
            download
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Vorlage
          </a>
          {canEditData && (
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neues Briefing
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Gesamt Briefings"
          value={briefingStats.total}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          title="Bestellt"
          value={briefingStats.ordered}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="In Bearbeitung"
          value={briefingStats.inProgress}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        />
        <StatCard
          title="Fertig"
          value={briefingStats.completed}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Neues Briefing Form */}
      {showNewForm && canEditData && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Neues Briefing bestellen
          </h2>
          <div className="space-y-6">
            {/* Briefing-Typ Auswahl */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Briefing-Typ auswählen *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setNewBriefingType("new_content")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    newBriefingType === "new_content"
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium text-slate-900 dark:text-white">Neuer Content</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Komplett neue Seite oder Artikel erstellen
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setNewBriefingType("edit_content")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    newBriefingType === "edit_content"
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="font-medium text-slate-900 dark:text-white">Content überarbeiten</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bestehende Seite optimieren oder erweitern
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setNewBriefingType("lexicon")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    newBriefingType === "lexicon"
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className="font-medium text-slate-900 dark:text-white">Lexikon Content</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Glossar-Eintrag oder Begriffserklärung
                  </p>
                </button>
              </div>
            </div>

            {/* Kategorie-Auswahl */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Kategorie
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="">Keine Kategorie</option>
                {KEYWORD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Zur besseren Zuordnung und Auswertung
              </p>
            </div>

            {/* Grunddaten */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {newBriefingType === "lexicon" ? "Begriff / Titel *" : "Briefing-Titel *"}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={newBriefingType === "lexicon" ? "z.B. Hypothek, Amortisation, ETF" : "z.B. Hypotheken Ratgeber Seite"}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              
              {/* Ausgangslage - nur bei edit_content */}
              {newBriefingType === "edit_content" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Art der Überarbeitung
                  </label>
                  <select
                    value={newContentAction}
                    onChange={(e) => setNewContentAction(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="edit">Content überarbeiten</option>
                    <option value="merge">Content mergen</option>
                  </select>
                </div>
              )}
              
              {/* Funnel-Stufe - nicht bei Lexikon */}
              {newBriefingType !== "lexicon" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Funnel-Stufe
                  </label>
                  <select
                    value={newFunnelStage}
                    onChange={(e) => setNewFunnelStage(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="">Auswählen...</option>
                    <option value="attention">Attention (Aufmerksamkeit)</option>
                    <option value="interest">Interest (Interesse)</option>
                    <option value="desire">Desire (Verlangen)</option>
                    <option value="action">Action (Handlung)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Lexikon-spezifische Felder */}
            {newBriefingType === "lexicon" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Kurze Definition
                  </label>
                  <textarea
                    value={newLexiconDefinition}
                    onChange={(e) => setNewLexiconDefinition(e.target.value)}
                    placeholder="Was ist der Begriff in 1-2 Sätzen? (Falls bekannt)"
                    rows={2}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Synonyme / Alternative Begriffe
                    </label>
                    <textarea
                      value={newLexiconSynonyms}
                      onChange={(e) => setNewLexiconSynonyms(e.target.value)}
                      placeholder="z.B. Hauskauf-Darlehen, Immobilienkredit"
                      rows={2}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Verwandte Begriffe
                    </label>
                    <textarea
                      value={newLexiconRelated}
                      onChange={(e) => setNewLexiconRelated(e.target.value)}
                      placeholder="z.B. Amortisation, Zins, Tragbarkeit"
                      rows={2}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Zielgruppe - nicht bei Lexikon */}
            {newBriefingType !== "lexicon" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Zielgruppe
                </label>
                <textarea
                  value={newTargetAudience}
                  onChange={(e) => setNewTargetAudience(e.target.value)}
                  placeholder="Beschreiben Sie die Zielgruppe..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            )}

            {/* Ziele - nicht bei Lexikon */}
            {newBriefingType !== "lexicon" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ziele / KPIs (User Story)
                </label>
                <textarea
                  value={newGoals}
                  onChange={(e) => setNewGoals(e.target.value)}
                  placeholder="Als [Nutzer] möchte ich [Ziel], damit [Nutzen]..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            )}

            {/* Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fokus-Keyword
                </label>
                <input
                  type="text"
                  value={newFocusKeyword}
                  onChange={(e) => setNewFocusKeyword(e.target.value)}
                  placeholder={newBriefingType === "lexicon" ? "Begriff als Keyword" : "Haupt-Keyword"}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Search Intent
                </label>
                <select
                  value={newSearchIntent}
                  onChange={(e) => setNewSearchIntent(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Auswählen...</option>
                  <option value="informational">Informational</option>
                  <option value="navigational">Navigational</option>
                  <option value="transactional">Transactional</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {newBriefingType === "edit_content" ? "Bestehende URL *" : "URL"}
                </label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Keyword/Topic Cluster - bei neuem Content und Lexikon */}
            {(newBriefingType === "new_content" || newBriefingType === "lexicon") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Keyword-Cluster
                  </label>
                  <textarea
                    value={newKeywordCluster}
                    onChange={(e) => setNewKeywordCluster(e.target.value)}
                    placeholder="Verwandte Keywords (eines pro Zeile)"
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Topic-Cluster
                  </label>
                  <textarea
                    value={newTopicCluster}
                    onChange={(e) => setNewTopicCluster(e.target.value)}
                    placeholder="Verwandte Themen"
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* Benchmark URLs - nur bei neuem Content und Überarbeitung */}
            {newBriefingType !== "lexicon" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Benchmark URLs (Wettbewerber)
                  </label>
                  <textarea
                    value={newBenchmarkUrls}
                    onChange={(e) => setNewBenchmarkUrls(e.target.value)}
                    placeholder="URLs von Wettbewerber-Seiten (eine pro Zeile)"
                    rows={2}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    CS Artikel (wenn vorhanden)
                  </label>
                  <textarea
                    value={newCsArticle}
                    onChange={(e) => setNewCsArticle(e.target.value)}
                    placeholder="Link oder Referenz zum CS Artikel"
                    rows={2}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={createBriefing}
                disabled={isSubmitting || !newTitle.trim() || (newBriefingType === "edit_content" && !newUrl.trim())}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSubmitting ? "Bestelle..." : "Briefing bestellen"}
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            <option value="ordered">Bestellt</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="in_review">In Prüfung</option>
            <option value="completed">Fertig</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Kategorie
          </label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle Kategorien</option>
            {KEYWORD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            <option value="__no_category__">Keine Kategorie</option>
          </select>
        </div>
        {(filterStatus !== "all" || filterCategory !== "all") && (
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterStatus("all");
                setFilterCategory("all");
              }}
              className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg text-sm transition-colors"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Timeline View */}
      {viewMode === "timeline" && (
        <BriefingTimelineView
          briefings={filteredBriefings}
          onBriefingClick={setSelectedBriefing}
          filterStatus={filterStatus}
          filterCategory={filterCategory}
        />
      )}

      {/* Briefings Liste und Detail */}
      {viewMode === "list" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Briefings Liste */}
        <div className="space-y-3">
          {filteredBriefings.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                {briefings.length === 0
                  ? "Noch keine Briefings vorhanden"
                  : "Keine Briefings mit diesem Filter"}
              </p>
            </div>
          ) : (
            filteredBriefings.map((briefing) => (
              <div
                key={briefing.id}
                onClick={() => setSelectedBriefing(briefing)}
                className={`bg-white dark:bg-slate-800 rounded-xl p-4 border cursor-pointer transition-all ${
                  selectedBriefing?.id === briefing.id
                    ? "border-blue-500 ring-2 ring-blue-500/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        #{briefing.briefingNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${getBriefingTypeColor(
                          briefing.briefingType
                        )}`}
                      >
                        {getBriefingTypeLabel(briefing.briefingType)}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(
                          briefing.status
                        )}`}
                      >
                        {getStatusLabel(briefing.status)}
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-900 dark:text-white truncate">
                      {briefing.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {briefing.category && (
                        <span className="text-slate-500 dark:text-slate-400">{briefing.category} • </span>
                      )}
                      {briefing.briefingType !== "lexicon" && getContentActionLabel(briefing.contentAction)}
                      {briefing.focusKeyword && (briefing.briefingType !== "lexicon" ? ` • ${briefing.focusKeyword}` : briefing.focusKeyword)}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-500">
                      <span>{briefing.requester.name || briefing.requester.email}</span>
                      <span>•</span>
                      <span>{formatDate(briefing.createdAt)}</span>
                      {briefing.deadline && (
                        <>
                          <span>•</span>
                          <span className={`flex items-center gap-1 ${
                            new Date(briefing.deadline) < new Date() && briefing.status !== "completed" && briefing.status !== "in_review"
                              ? "text-red-500 font-medium"
                              : new Date(briefing.deadline) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) && briefing.status !== "completed" && briefing.status !== "in_review"
                              ? "text-orange-500"
                              : ""
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Deadline: {formatDate(briefing.deadline)}
                          </span>
                        </>
                      )}
                    </div>
                    {/* Download PDF Button - bei Status "in_review" oder "completed" */}
                    {(briefing.status === "in_review" || briefing.status === "completed") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadBriefingPdf(briefing);
                        }}
                        className="mt-3 flex items-center gap-2 px-3 py-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PDF herunterladen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Briefing Detail */}
        {selectedBriefing && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[calc(100vh-300px)] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      #{selectedBriefing.briefingNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full border ${getBriefingTypeColor(
                        selectedBriefing.briefingType
                      )}`}
                    >
                      {getBriefingTypeLabel(selectedBriefing.briefingType)}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(
                        selectedBriefing.status
                      )}`}
                    >
                      {getStatusLabel(selectedBriefing.status)}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {selectedBriefing.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Bestellt von {selectedBriefing.requester.name || selectedBriefing.requester.email} am{" "}
                    {formatDate(selectedBriefing.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* PDF Download Button - bei Status "in_review" oder "completed" */}
                  {(selectedBriefing.status === "in_review" || selectedBriefing.status === "completed") && (
                    <button
                      onClick={() => downloadBriefingPdf(selectedBriefing)}
                      className="p-2 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"
                      title="PDF herunterladen"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => deleteBriefing(selectedBriefing.id)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Briefing löschen"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Status und Deadline ändern (nur Admin) */}
              {isAdmin && (
                <div className="mt-4 flex flex-wrap gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Status ändern
                    </label>
                    <select
                      value={selectedBriefing.status}
                      onChange={(e) => updateBriefing(selectedBriefing.id, { status: e.target.value as Briefing["status"] })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border ${getStatusColor(
                        selectedBriefing.status
                      )} bg-transparent`}
                    >
                      <option value="ordered">Bestellt</option>
                      <option value="in_progress">In Bearbeitung</option>
                      <option value="in_review">In Prüfung</option>
                      <option value="completed">Fertig</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={selectedBriefing.deadline ? new Date(selectedBriefing.deadline).toISOString().split('T')[0] : ''}
                      onChange={(e) => updateBriefing(selectedBriefing.id, { deadline: e.target.value || null })}
                      className={`px-3 py-2 rounded-lg text-sm border bg-white dark:bg-slate-900 text-slate-900 dark:text-white ${
                        selectedBriefing.deadline && new Date(selectedBriefing.deadline) < new Date() && selectedBriefing.status !== "completed" && selectedBriefing.status !== "in_review"
                          ? "border-red-500 text-red-500"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Briefing Daten */}
            <div className="p-6 space-y-6">
              {/* Bestelldaten */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Bestelldaten
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Kategorie:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{selectedBriefing.category || "Keine"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Ausgangslage:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{getContentActionLabel(selectedBriefing.contentAction)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Funnel-Stufe:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{getFunnelStageLabel(selectedBriefing.funnelStage)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Search Intent:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{getSearchIntentLabel(selectedBriefing.searchIntent)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Fokus-Keyword:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{selectedBriefing.focusKeyword || "-"}</span>
                  </div>
                  {!isAdmin && selectedBriefing.deadline && (
                    <div className="col-span-2">
                      <span className="text-slate-500 dark:text-slate-400">Deadline:</span>
                      <span className={`ml-2 ${
                        new Date(selectedBriefing.deadline) < new Date() && selectedBriefing.status !== "completed" && selectedBriefing.status !== "in_review"
                          ? "text-red-500 font-medium"
                          : "text-slate-900 dark:text-white"
                      }`}>
                        {formatDate(selectedBriefing.deadline)}
                        {new Date(selectedBriefing.deadline) < new Date() && selectedBriefing.status !== "completed" && selectedBriefing.status !== "in_review" && " (überfällig)"}
                      </span>
                    </div>
                  )}
                </div>
                {selectedBriefing.targetAudience && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Zielgruppe:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1">{selectedBriefing.targetAudience}</p>
                  </div>
                )}
                {selectedBriefing.goals && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Ziele / KPIs:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.goals}</p>
                  </div>
                )}
                {selectedBriefing.url && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">URL:</span>
                    <a href={selectedBriefing.url} target="_blank" rel="noopener noreferrer" className="block text-blue-500 hover:underline text-sm mt-1 break-all">
                      {selectedBriefing.url}
                    </a>
                  </div>
                )}
                {selectedBriefing.keywordCluster && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Keyword-Cluster:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.keywordCluster}</p>
                  </div>
                )}
                {selectedBriefing.topicCluster && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Topic-Cluster:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.topicCluster}</p>
                  </div>
                )}
                {selectedBriefing.benchmarkUrls && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Benchmark URLs:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.benchmarkUrls}</p>
                  </div>
                )}
                {selectedBriefing.csArticle && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">CS Artikel:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.csArticle}</p>
                  </div>
                )}
                
                {/* Lexikon-spezifische Felder */}
                {selectedBriefing.briefingType === "lexicon" && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h4 className="text-xs font-semibold text-purple-500 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Lexikon-Informationen
                    </h4>
                    {selectedBriefing.lexiconDefinition && (
                      <div className="mb-3">
                        <span className="text-slate-500 dark:text-slate-400 text-sm">Definition:</span>
                        <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.lexiconDefinition}</p>
                      </div>
                    )}
                    {selectedBriefing.lexiconSynonyms && (
                      <div className="mb-3">
                        <span className="text-slate-500 dark:text-slate-400 text-sm">Synonyme:</span>
                        <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.lexiconSynonyms}</p>
                      </div>
                    )}
                    {selectedBriefing.lexiconRelated && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-sm">Verwandte Begriffe:</span>
                        <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.lexiconRelated}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Content-Aufbau (nur Admin kann bearbeiten) */}
              {isAdmin && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Content-Aufbau (Agentur)
                    {isSaving && <span className="text-xs text-slate-400 ml-2">Speichert...</span>}
                  </h3>
                  <div className="space-y-4">
                    {/* Title Tag */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Title Tag</label>
                        {isAgenturUser && (
                          <button
                            onClick={() => generateAiSuggestion(selectedBriefing.id, "titleTag")}
                            disabled={aiLoadingField === "titleTag"}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                            title="KI-Vorschlag generieren"
                          >
                            {aiLoadingField === "titleTag" ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                            )}
                            KI
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={selectedBriefing.titleTag || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { titleTag: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Meta Description */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Meta Description</label>
                        {isAgenturUser && (
                          <button
                            onClick={() => generateAiSuggestion(selectedBriefing.id, "metaDescription")}
                            disabled={aiLoadingField === "metaDescription"}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                            title="KI-Vorschlag generieren"
                          >
                            {aiLoadingField === "metaDescription" ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                            )}
                            KI
                          </button>
                        )}
                      </div>
                      <textarea
                        value={selectedBriefing.metaDescription || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { metaDescription: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Navigationstitel & H1 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Navigationstitel</label>
                          {isAgenturUser && (
                            <button
                              onClick={() => generateAiSuggestion(selectedBriefing.id, "navTitle")}
                              disabled={aiLoadingField === "navTitle"}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                              title="KI-Vorschlag generieren"
                            >
                              {aiLoadingField === "navTitle" ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                              )}
                              KI
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={selectedBriefing.navTitle || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { navTitle: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">H1</label>
                          {isAgenturUser && (
                            <button
                              onClick={() => generateAiSuggestion(selectedBriefing.id, "h1")}
                              disabled={aiLoadingField === "h1"}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                              title="KI-Vorschlag generieren"
                            >
                              {aiLoadingField === "h1" ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                              )}
                              KI
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={selectedBriefing.h1 || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { h1: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Hauptparagraf */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Hauptparagraf</label>
                        {isAgenturUser && (
                          <button
                            onClick={() => generateAiSuggestion(selectedBriefing.id, "mainParagraph")}
                            disabled={aiLoadingField === "mainParagraph"}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                            title="KI-Vorschlag generieren"
                          >
                            {aiLoadingField === "mainParagraph" ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                            )}
                            KI
                          </button>
                        )}
                      </div>
                      <textarea
                        value={selectedBriefing.mainParagraph || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { mainParagraph: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* CTAs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Primary CTA</label>
                          {isAgenturUser && (
                            <button
                              onClick={() => generateAiSuggestion(selectedBriefing.id, "primaryCta")}
                              disabled={aiLoadingField === "primaryCta"}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                              title="KI-Vorschlag generieren"
                            >
                              {aiLoadingField === "primaryCta" ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                              )}
                              KI
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={selectedBriefing.primaryCta || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { primaryCta: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Secondary CTA</label>
                          {isAgenturUser && (
                            <button
                              onClick={() => generateAiSuggestion(selectedBriefing.id, "secondaryCta")}
                              disabled={aiLoadingField === "secondaryCta"}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                              title="KI-Vorschlag generieren"
                            >
                              {aiLoadingField === "secondaryCta" ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                              )}
                              KI
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={selectedBriefing.secondaryCta || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { secondaryCta: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Inbound CTA</label>
                          {isAgenturUser && (
                            <button
                              onClick={() => generateAiSuggestion(selectedBriefing.id, "inboundCta")}
                              disabled={aiLoadingField === "inboundCta"}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                              title="KI-Vorschlag generieren"
                            >
                              {aiLoadingField === "inboundCta" ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                              )}
                              KI
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={selectedBriefing.inboundCta || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { inboundCta: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Keywordset/Longtail und Topiccluster */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Keywordset/Longtail</label>
                          {isAgenturUser && (
                            <button
                              onClick={() => generateAiSuggestion(selectedBriefing.id, "keywordsetLongtail")}
                              disabled={aiLoadingField === "keywordsetLongtail"}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                              title="KI-Vorschlag generieren"
                            >
                              {aiLoadingField === "keywordsetLongtail" ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                              )}
                              KI
                            </button>
                          )}
                        </div>
                        <textarea
                          value={selectedBriefing.keywordsetLongtail || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { keywordsetLongtail: e.target.value })}
                          rows={4}
                          placeholder="kredit beantragen online&#10;kredit aufnehmen voraussetzungen&#10;kredit zinsen vergleich&#10;..."
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Topiccluster</label>
                          {isAgenturUser && (
                            <button
                              onClick={() => generateAiSuggestion(selectedBriefing.id, "topicclusterContent")}
                              disabled={aiLoadingField === "topicclusterContent"}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                              title="KI-Vorschlag generieren"
                            >
                              {aiLoadingField === "topicclusterContent" ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                              )}
                              KI
                            </button>
                          )}
                        </div>
                        <textarea
                          value={selectedBriefing.topicclusterContent || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { topicclusterContent: e.target.value })}
                          rows={4}
                          placeholder="Hypothekarzinsen&#10;Amortisation&#10;Tragbarkeit&#10;Eigenkapital&#10;..."
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Fliesstext/Struktur */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Fliesstext/Struktur (H2 – H4)</label>
                        {isAgenturUser && (
                          <button
                            onClick={() => generateAiSuggestion(selectedBriefing.id, "bodyContent")}
                            disabled={aiLoadingField === "bodyContent"}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                            title="KI-Vorschlag generieren"
                          >
                            {aiLoadingField === "bodyContent" ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                            )}
                            KI
                          </button>
                        )}
                      </div>
                      <textarea
                        value={selectedBriefing.bodyContent || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { bodyContent: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Grafische Darstellung */}
                    <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Grafische Darstellung
                        </label>
                        {isAgenturUser && (
                          <div className="flex items-center gap-2">
                            {selectedBriefing.diagramUrl && (
                              <button
                                onClick={() => deleteDiagram(selectedBriefing.id)}
                                disabled={diagramLoading}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors disabled:opacity-50"
                                title="Diagramm löschen"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => generateDiagram(selectedBriefing.id)}
                              disabled={diagramLoading || !selectedBriefing.bodyContent}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded transition-colors disabled:opacity-50"
                              title={selectedBriefing.bodyContent ? "Schaubild mit KI generieren" : "Zuerst Fliesstext/Struktur ausfüllen"}
                            >
                              {diagramLoading ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                              )}
                              {selectedBriefing.diagramUrl ? "Neu generieren" : "KI generieren"}
                            </button>
                            <label
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded transition-colors cursor-pointer disabled:opacity-50"
                              title="Eigenes Schaubild hochladen"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Hochladen
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={diagramLoading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    uploadDiagram(selectedBriefing.id, file);
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                      {selectedBriefing.diagramUrl ? (
                        <div className="space-y-2">
                          <a href={getAuthenticatedBlobUrl(selectedBriefing.diagramUrl)} target="_blank" rel="noopener noreferrer" className="block">
                            <img 
                              src={getAuthenticatedBlobUrl(selectedBriefing.diagramUrl)} 
                              alt="Grafische Darstellung" 
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity cursor-pointer"
                            />
                          </a>
                          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                            Klicken zum Öffnen in neuem Tab
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm">Noch kein Schaubild generiert</p>
                          {!selectedBriefing.bodyContent && (
                            <p className="text-xs mt-1">Zuerst Fliesstext/Struktur ausfüllen</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Interne Verlinkungen */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Interne Verlinkungen</label>
                        {isAgenturUser && (
                          <button
                            onClick={() => generateAiSuggestion(selectedBriefing.id, "internalLinks")}
                            disabled={aiLoadingField === "internalLinks"}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                            title="KI-Vorschlag generieren"
                          >
                            {aiLoadingField === "internalLinks" ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                            )}
                            KI
                          </button>
                        )}
                      </div>
                      <textarea
                        value={selectedBriefing.internalLinks || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { internalLinks: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Missing Topics - nur bei edit_content */}
                    {selectedBriefing.briefingType === "edit_content" && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Missing Topics</label>
                          {isAgenturUser && (
                            <button
                              onClick={() => generateAiSuggestion(selectedBriefing.id, "missingTopics")}
                              disabled={aiLoadingField === "missingTopics"}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                              title="KI-Vorschlag generieren"
                            >
                              {aiLoadingField === "missingTopics" ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                              )}
                              KI
                            </button>
                          )}
                        </div>
                        <textarea
                          value={selectedBriefing.missingTopics || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { missingTopics: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    )}

                    {/* FAQs */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">FAQs</label>
                        {isAgenturUser && (
                          <button
                            onClick={() => generateAiSuggestion(selectedBriefing.id, "faqs")}
                            disabled={aiLoadingField === "faqs"}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 rounded transition-colors disabled:opacity-50"
                            title="KI-Vorschlag generieren"
                          >
                            {aiLoadingField === "faqs" ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                            )}
                            KI
                          </button>
                        )}
                      </div>
                      <textarea
                        value={selectedBriefing.faqs || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { faqs: e.target.value })}
                        rows={4}
                        placeholder="Q: Frage 1?&#10;A: Antwort 1&#10;&#10;Q: Frage 2?&#10;A: Antwort 2"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Bemerkungen (ohne KI) */}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Bemerkungen</label>
                      <textarea
                        value={selectedBriefing.notes || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { notes: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Mehrsprachigkeit */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">Weitere Sprachen</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">EN Titel</label>
                          <input
                            type="text"
                            value={selectedBriefing.titleEn || ""}
                            onChange={(e) => updateBriefing(selectedBriefing.id, { titleEn: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">FR Titel</label>
                          <input
                            type="text"
                            value={selectedBriefing.titleFr || ""}
                            onChange={(e) => updateBriefing(selectedBriefing.id, { titleFr: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">IT Titel</label>
                          <input
                            type="text"
                            value={selectedBriefing.titleIt || ""}
                            onChange={(e) => updateBriefing(selectedBriefing.id, { titleIt: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Content-Ansicht für Member (nur lesen) */}
              {!isAdmin && selectedBriefing.status !== "ordered" && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    Content-Aufbau
                  </h3>
                  <div className="space-y-3 text-sm">
                    {selectedBriefing.titleTag && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Title Tag:</span>
                        <p className="text-slate-900 dark:text-white">{selectedBriefing.titleTag}</p>
                      </div>
                    )}
                    {selectedBriefing.metaDescription && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Meta Description:</span>
                        <p className="text-slate-900 dark:text-white">{selectedBriefing.metaDescription}</p>
                      </div>
                    )}
                    {selectedBriefing.h1 && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">H1:</span>
                        <p className="text-slate-900 dark:text-white">{selectedBriefing.h1}</p>
                      </div>
                    )}
                    {selectedBriefing.mainParagraph && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Hauptparagraf:</span>
                        <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{selectedBriefing.mainParagraph}</p>
                      </div>
                    )}
                    {selectedBriefing.bodyContent && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Fliesstext/Struktur:</span>
                        <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{selectedBriefing.bodyContent}</p>
                      </div>
                    )}
                    {selectedBriefing.diagramUrl && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Grafische Darstellung:
                        </span>
                        <a href={getAuthenticatedBlobUrl(selectedBriefing.diagramUrl)} target="_blank" rel="noopener noreferrer" className="block">
                          <img 
                            src={getAuthenticatedBlobUrl(selectedBriefing.diagramUrl)} 
                            alt="Grafische Darstellung" 
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 hover:opacity-90 transition-opacity cursor-pointer"
                          />
                        </a>
                        <p className="text-xs text-slate-400 mt-1 text-center">Klicken zum Öffnen in neuem Tab</p>
                      </div>
                    )}
                    {selectedBriefing.faqs && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">FAQs:</span>
                        <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{selectedBriefing.faqs}</p>
                      </div>
                    )}
                    {selectedBriefing.notes && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Bemerkungen:</span>
                        <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{selectedBriefing.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Detail-Modal bei Timeline-Ansicht */}
      {viewMode === "timeline" && selectedBriefing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedBriefing(null)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm text-slate-500 dark:text-slate-400">#{selectedBriefing.briefingNumber}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${
                    selectedBriefing.briefingType === "new_content" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : selectedBriefing.briefingType === "edit_content" ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                    : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                  }`}>
                    {selectedBriefing.briefingType === "new_content" ? "Neuer Content" : selectedBriefing.briefingType === "edit_content" ? "Content überarbeiten" : "Lexikon Content"}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${BRIEFING_STATUS_CONFIG[selectedBriefing.status]?.bgColor} ${BRIEFING_STATUS_CONFIG[selectedBriefing.status]?.color}`}>
                    {BRIEFING_STATUS_CONFIG[selectedBriefing.status]?.label}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{selectedBriefing.title}</h2>
              </div>
              <button
                onClick={() => setSelectedBriefing(null)}
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Metadaten */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Bestellt von</span>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedBriefing.requester.name || selectedBriefing.requester.email}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Zugewiesen an</span>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">
                    {selectedBriefing.assignee ? (selectedBriefing.assignee.name || selectedBriefing.assignee.email) : "Noch nicht zugewiesen"}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Erstellt am</span>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5">{formatDate(selectedBriefing.createdAt)}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Deadline</span>
                  <p className={`text-sm mt-0.5 ${
                    selectedBriefing.deadline && new Date(selectedBriefing.deadline) < new Date() && selectedBriefing.status !== "completed"
                      ? "text-red-500 font-medium"
                      : "text-slate-900 dark:text-white"
                  }`}>
                    {selectedBriefing.deadline ? formatDate(selectedBriefing.deadline) : "Keine Deadline"}
                  </p>
                </div>
              </div>

              {/* Kategorie & Typ Details */}
              <div className="grid grid-cols-2 gap-4">
                {selectedBriefing.category && (
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Kategorie</span>
                    <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedBriefing.category}</p>
                  </div>
                )}
                {selectedBriefing.focusKeyword && (
                  <div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Fokus-Keyword</span>
                    <p className="text-sm text-slate-900 dark:text-white mt-0.5">{selectedBriefing.focusKeyword}</p>
                  </div>
                )}
              </div>

              {/* URL */}
              {selectedBriefing.url && (
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">URL</span>
                  <a href={selectedBriefing.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline block mt-0.5 truncate">
                    {selectedBriefing.url}
                  </a>
                </div>
              )}

              {/* Zielgruppe & Ziele */}
              {selectedBriefing.targetAudience && (
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Zielgruppe</span>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{selectedBriefing.targetAudience}</p>
                </div>
              )}
              {selectedBriefing.goals && (
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Ziele / KPIs</span>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{selectedBriefing.goals}</p>
                </div>
              )}
              {selectedBriefing.notes && (
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Notizen</span>
                  <p className="text-sm text-slate-900 dark:text-white mt-0.5 whitespace-pre-wrap">{selectedBriefing.notes}</p>
                </div>
              )}

              {/* Zur vollen Ansicht wechseln */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setViewMode("list")}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Vollständige Detailansicht öffnen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
