"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import { formatReviewDueDateDe, isReviewStepPastDue } from "@/lib/review-deadline";

// --- Types ---

interface ArticleStatusHistory {
  id: string;
  fromStatus: string;
  toStatus: string;
  changedByEmail: string;
  changedByName: string | null;
  comment: string | null;
  createdAt: string;
}

interface ArticleComment {
  id: string;
  articleId: string;
  authorId: string;
  author: { id: string; name: string | null; email: string };
  selectedText: string;
  commentText: string;
  role: "compliance" | "legal" | "produktmanagement" | "brand";
  resolved: boolean;
  changeAndForward: boolean;
  recheckAfterRevision: boolean;
  createdAt: string;
}

interface ArticleImage {
  id: string;
  articleId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  uploadedBy: { id: string; name: string | null; email: string };
  createdAt: string;
}

interface Article {
  id: string;
  contentNumber: number;
  title: string;
  slug: string;
  funnelStage: string;
  category: string;
  targetAudience: string;
  htmlContent: string;
  metaTitle: string | null;
  metaDescription: string | null;
  wordCount: number;
  reviewStatus: string;
  complianceApprovedAt: string | null;
  legalApprovedAt: string | null;
  eloxxImportedAt: string | null;
  eloxxImportedBy: string | null;
  revisionRequestedAt: string | null;
  revisionRequestedBy: string | null;
  claimedAt: string | null;
  claimedByUserId: string | null;
  claimedByName: string | null;
  reviewStepDueAt: string | null;
  creator: { id: string; name: string | null; email: string };
  comments: ArticleComment[];
  images?: ArticleImage[];
  statusHistory?: ArticleStatusHistory[];
  _count?: { comments: number; unresolvedComments: number; resolvedComments: number };
  createdAt: string;
}

// --- Constants ---

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

const LEXIKON_SUBCATEGORIES = [
  "Finanzierungsbegriffe",
  "Immobilienbegriffe",
  "Rechtliche Begriffe",
  "Versicherungsbegriffe",
  "Steuerbegriffe",
  "Allgemeine Bankbegriffe",
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Entwurf", color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-700" },
  pm_review: { label: "Produkt Management", color: "text-cyan-700 dark:text-cyan-300", bg: "bg-cyan-100 dark:bg-cyan-900/40" },
  brand_review: { label: "Brand-Check", color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-900/40" },
  brand_approved: { label: "Brand OK", color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-900/40" },
  compliance_review: { label: "Compliance Review", color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-900/40" },
  compliance_approved: { label: "Compliance OK", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-900/40" },
  legal_review: { label: "Legal Review", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-900/40" },
  legal_approved: { label: "Legal OK", color: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-100 dark:bg-indigo-900/40" },
  production_ready: { label: "Production Ready", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-900/40" },
  published: { label: "Published", color: "text-green-700 dark:text-green-300", bg: "bg-green-100 dark:bg-green-900/40" },
};

const STATUS_FLOW = [
  "draft",
  "pm_review",
  "brand_review",
  "brand_approved",
  "compliance_review",
  "compliance_approved",
  "legal_review",
  "legal_approved",
  "production_ready",
  "published",
];

const NEXT_STATUS: Record<string, { status: string; label: string; color: string }> = {
  draft: { status: "pm_review", label: "An Produkt Management senden", color: "bg-cyan-600 hover:bg-cyan-700" },
  pm_review: { status: "brand_review", label: "An Brand senden", color: "bg-rose-600 hover:bg-rose-700" },
  brand_review: { status: "brand_approved", label: "Brand freigeben", color: "bg-rose-600 hover:bg-rose-700" },
  brand_approved: { status: "compliance_review", label: "An Compliance senden", color: "bg-amber-600 hover:bg-amber-700" },
  compliance_review: { status: "compliance_approved", label: "Compliance freigeben", color: "bg-blue-600 hover:bg-blue-700" },
  compliance_approved: { status: "legal_review", label: "An Legal senden", color: "bg-orange-600 hover:bg-orange-700" },
  legal_review: { status: "legal_approved", label: "Legal freigeben", color: "bg-indigo-600 hover:bg-indigo-700" },
  legal_approved: { status: "production_ready", label: "Production Ready setzen", color: "bg-emerald-600 hover:bg-emerald-700" },
  production_ready: { status: "published", label: "Als Published markieren", color: "bg-green-600 hover:bg-green-700" },
};

const COMMENT_ROLE_LABELS: Record<string, string> = {
  produktmanagement: "ProduktMgmt",
  brand: "Brand",
  compliance: "Compliance",
  legal: "Legal",
};

const COMMENT_ROLE_STYLES: Record<string, string> = {
  produktmanagement: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300",
  brand: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300",
  compliance: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  legal: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
};

// --- Main Component ---

export default function ContentCheckPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [commentFilter, setCommentFilter] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const userRole = session?.user?.role;
  const userId = session?.user?.id;
  const isAgentur = userRole === "agentur";
  const canEditContent = userRole === "agentur" || userRole === "produktmanagement";

  const loadArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/content-reviews");
      if (res.ok) setArticles(await res.json());
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    const articleId = searchParams.get("article");
    if (articleId) {
      openArticle(articleId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteArticle = async (id: string) => {
    if (!confirm("Artikel wirklich löschen? Alle Kommentare und die gesamte Status-Historie werden ebenfalls gelöscht.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/content-reviews/${id}`, { method: "DELETE" });
      if (res.ok) {
        setArticles((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // Ignore
    } finally {
      setDeletingId(null);
    }
  };

  const openArticle = async (id: string) => {
    const res = await fetch(`/api/content-reviews/${id}`);
    if (res.ok) {
      setSelectedArticle(await res.json());
      router.replace(`/content-check?article=${id}`, { scroll: false });
    }
  };

  const isLexikonArticle = (category: string) =>
    category === "Lexikon" || LEXIKON_SUBCATEGORIES.includes(category);

  const categoryCount = (cat: string) => {
    if (cat === "Lexikon") return articles.filter((a) => isLexikonArticle(a.category)).length;
    return articles.filter((a) => a.category === cat).length;
  };

  const filteredArticles = articles
    .filter((a) => filterStatus === "all" || a.reviewStatus === filterStatus)
    .filter((a) => {
      if (filterCategory === "all") return true;
      if (filterCategory === "Lexikon") return isLexikonArticle(a.category);
      return a.category === filterCategory;
    })
    .filter((a) => {
      if (commentFilter === "all") return true;
      const total = a._count?.comments ?? 0;
      const unresolved = a._count?.unresolvedComments ?? 0;
      const resolved = a._count?.resolvedComments ?? 0;
      if (commentFilter === "none") return total === 0;
      if (commentFilter === "open") return unresolved > 0;
      if (commentFilter === "resolved") return resolved > 0 && unresolved === 0;
      return true;
    });

  const [exporting, setExporting] = useState(false);

  const extractIntroText = (html: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const intro = doc.querySelector(".intro");
    if (!intro) return "";
    return intro.textContent?.trim() || "";
  };

  const handleExcelExport = async () => {
    setExporting(true);
    try {
      const exportArticles = filteredArticles.filter(
        (a) => !isLexikonArticle(a.category)
      );

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Content Übersicht");

      sheet.columns = [
        { header: "Titel", key: "title", width: 45 },
        { header: "Kategorie", key: "category", width: 25 },
        { header: "Meta-Title", key: "metaTitle", width: 50 },
        { header: "Meta-Description", key: "metaDescription", width: 65 },
        { header: "Intro", key: "intro", width: 80 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      headerRow.alignment = { vertical: "middle" };

      for (const article of exportArticles) {
        const row = sheet.addRow({
          title: article.title,
          category: article.category,
          metaTitle: article.metaTitle || "",
          metaDescription: article.metaDescription || "",
          intro: extractIntroText(article.htmlContent),
        });
        row.alignment = { vertical: "top", wrapText: true };
      }

      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 5 },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().split("T")[0];
      a.download = `Content-Check_${filterCategory !== "all" ? filterCategory + "_" : ""}${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Excel export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  if (selectedArticle) {
    return (
      <ArticleReviewView
        article={selectedArticle}
        onBack={() => {
          setSelectedArticle(null);
          router.replace("/content-check", { scroll: false });
          loadArticles();
        }}
        onUpdate={(updated) => setSelectedArticle(updated)}
        isAgentur={isAgentur}
        canEditContent={canEditContent}
        userId={userId}
        onDelete={async () => {
          await handleDeleteArticle(selectedArticle.id);
          setSelectedArticle(null);
          router.replace("/content-check", { scroll: false });
        }}
      />
    );
  }

  const exportableCount = filteredArticles.filter(
    (a) => !isLexikonArticle(a.category)
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Content Check</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Freigabe-Workflow: Entwurf &rarr; Produkt Management &rarr; Brand-Check &rarr; Compliance &rarr; Legal &rarr; Production Ready &rarr; Published
        </p>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status-Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filterStatus === "all"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            Alle ({articles.length})
          </button>
          {STATUS_FLOW.map((status) => {
            const config = STATUS_CONFIG[status];
            const count = articles.filter((a) => a.reviewStatus === status).length;
            if (count === 0 && filterStatus !== status) return null;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  filterStatus === status
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : `${config.bg} ${config.color} hover:opacity-80`
                }`}
              >
                {config.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Kommentar-Filter */}
        <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 hidden sm:block" />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="all">Alle Kategorien ({articles.length})</option>
          {RATGEBER_CATEGORIES.map((cat) => {
            const count = categoryCount(cat);
            return (
              <option key={cat} value={cat}>{cat} ({count})</option>
            );
          })}
        </select>
        <select
          value={commentFilter}
          onChange={(e) => setCommentFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="all">Alle Kommentare</option>
          <option value="none">Ohne Kommentare</option>
          <option value="open">Offene Kommentare</option>
          <option value="resolved">Nur erledigte Kommentare</option>
        </select>
        <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 hidden sm:block" />
        <button
          onClick={handleExcelExport}
          disabled={exporting || exportableCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {exporting ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          Bilddaten Export ({exportableCount})
        </button>
      </div>

      {/* Artikel-Liste */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <svg className="animate-spin h-6 w-6 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Lade Artikel...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            {filterStatus === "all" && filterCategory === "all" && commentFilter === "all"
              ? "Noch keine generierten Artikel vorhanden."
              : `Keine Artikel für die gewählten Filter gefunden.`}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredArticles.map((article) => {
              const statusConfig = STATUS_CONFIG[article.reviewStatus] || STATUS_CONFIG.draft;
              const commentCount = article._count?.comments ?? 0;
              const unresolvedCount = article._count?.unresolvedComments ?? 0;
              const resolvedCount = article._count?.resolvedComments ?? 0;
              return (
                <div
                  key={article.id}
                  className="flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <button
                    onClick={() => openArticle(article.id)}
                    className="flex-1 min-w-0 px-6 py-4 flex items-center gap-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        <span className="text-slate-400 dark:text-slate-500 font-mono mr-1.5">#{article.contentNumber}</span>
                        {article.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {article.funnelStage}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {article.category}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {article.wordCount} Wörter
                        </span>
                        {commentCount > 0 && (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <svg className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            {unresolvedCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">
                                {unresolvedCount} offen
                              </span>
                            )}
                            {resolvedCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium">
                                {resolvedCount} erledigt
                              </span>
                            )}
                          </span>
                        )}
                        {article.claimedByName && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {article.claimedByName}
                          </span>
                        )}
                        {article.reviewStepDueAt && article.reviewStatus !== "published" && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                              isReviewStepPastDue(new Date(article.reviewStepDueAt))
                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                : "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                            }`}
                            title="Frist für den aktuellen Workflow-Schritt (2 Werktage ab Weitergeben)"
                          >
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Frist {formatReviewDueDateDe(article.reviewStepDueAt)}
                            {isReviewStepPastDue(new Date(article.reviewStepDueAt)) && " · überfällig"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                      {new Date(article.createdAt).toLocaleDateString("de-DE")}
                    </div>
                    <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {isAgentur && (
                    <button
                      onClick={() => handleDeleteArticle(article.id)}
                      disabled={deletingId === article.id}
                      className="pr-4 p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors shrink-0"
                      title="Artikel löschen"
                    >
                      {deletingId === article.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Article Review Detail View ---

function ArticleReviewView({
  article,
  onBack,
  onUpdate,
  isAgentur,
  canEditContent,
  userId,
  onDelete,
}: {
  article: Article;
  onBack: () => void;
  onUpdate: (a: Article) => void;
  isAgentur: boolean;
  canEditContent: boolean;
  userId: string | undefined;
  onDelete: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [eloxxUpdating, setEloxxUpdating] = useState(false);
  const [requestingRevision, setRequestingRevision] = useState(false);
  const [showResetDropdown, setShowResetDropdown] = useState(false);
  const [resolvingRevision, setResolvingRevision] = useState(false);
  const [claimUpdating, setClaimUpdating] = useState(false);
  const [articleImages, setArticleImages] = useState<ArticleImage[]>(article.images || []);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const hasOpenRevision = !!article.revisionRequestedAt;
  const isClaimed = !!article.claimedAt;
  const isClaimedByMe = isClaimed && article.claimedByUserId === userId;
  const isClaimedByOther = isClaimed && article.claimedByUserId !== userId;

  const getDefaultCommentRole = (status: string): "compliance" | "legal" | "produktmanagement" | "brand" => {
    switch (status) {
      case "pm_review":
        return "produktmanagement";
      case "brand_review":
      case "brand_approved":
        return "brand";
      case "compliance_review":
      case "compliance_approved":
        return "compliance";
      case "legal_review":
      case "legal_approved":
        return "legal";
      default:
        return "produktmanagement";
    }
  };

  const [commentRole, setCommentRole] = useState<"compliance" | "legal" | "produktmanagement" | "brand">(getDefaultCommentRole(article.reviewStatus));
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [changeAndForward, setChangeAndForward] = useState(false);
  const [recheckAfterRevision, setRecheckAfterRevision] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCommentRole(getDefaultCommentRole(article.reviewStatus));
  }, [article.reviewStatus]);

  const canEdit = canEditContent;
  const [isEditing, setIsEditing] = useState(false);
  const [isHtmlView, setIsHtmlView] = useState(false);
  const [htmlSource, setHtmlSource] = useState("");
  const [editHtml, setEditHtml] = useState(article.htmlContent);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const editHtmlRef = useRef(article.htmlContent);
  const styleBlocksRef = useRef("");
  const cleanedOriginalRef = useRef("");
  const isHighlightingRef = useRef(false);
  const saveTriggeredRef = useRef(false);

  // SEO Meta inline editing
  const [editingMeta, setEditingMeta] = useState(false);
  const [editMetaTitle, setEditMetaTitle] = useState(article.metaTitle || "");
  const [editMetaDescription, setEditMetaDescription] = useState(article.metaDescription || "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [saveMetaSuccess, setSaveMetaSuccess] = useState(false);

  useEffect(() => {
    const styleMatches = article.htmlContent.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
    styleBlocksRef.current = styleMatches ? styleMatches.join("\n") : "";

    if (saveTriggeredRef.current) {
      saveTriggeredRef.current = false;
      if (editorRef.current) {
        const currentContent = editorRef.current.innerHTML;
        cleanedOriginalRef.current = currentContent;
        editHtmlRef.current = currentContent;
        setEditHtml(currentContent);
      }
    } else {
      setEditHtml(article.htmlContent);
      editHtmlRef.current = article.htmlContent;
      cleanedOriginalRef.current = "";
    }
  }, [article.htmlContent]);

  useEffect(() => {
    setEditMetaTitle(article.metaTitle || "");
    setEditMetaDescription(article.metaDescription || "");
    setEditingMeta(false);
  }, [article.metaTitle, article.metaDescription]);

  const hasUnsavedChanges = cleanedOriginalRef.current
    ? editHtml !== cleanedOriginalRef.current
    : false;

  const handleSaveContent = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      let bodyContent: string;

      if (isHtmlView) {
        bodyContent = htmlSource;
      } else {
        bodyContent = editHtmlRef.current;
        if (editorRef.current) {
          const clone = editorRef.current.cloneNode(true) as HTMLElement;
          clone.querySelectorAll(".content-check-highlight").forEach((mark) => {
            const parent = mark.parentNode;
            if (parent) {
              while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
              parent.removeChild(mark);
              parent.normalize();
            }
          });
          bodyContent = clone.innerHTML;
        }
      }

      const fullHtml = styleBlocksRef.current
        ? styleBlocksRef.current + "\n" + bodyContent
        : bodyContent;

      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: fullHtml }),
      });
      if (res.ok) {
        const updated = await res.json();
        saveTriggeredRef.current = true;
        onUpdate(updated);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {
      // Ignore
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMeta = async () => {
    setSavingMeta(true);
    setSaveMetaSuccess(false);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaTitle: editMetaTitle, metaDescription: editMetaDescription }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        setEditingMeta(false);
        setSaveMetaSuccess(true);
        setTimeout(() => setSaveMetaSuccess(false), 2000);
      }
    } catch {
      // Ignore
    } finally {
      setSavingMeta(false);
    }
  };

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEditorInput = useCallback(() => {
    if (isHighlightingRef.current) return;
    if (editorRef.current) {
      editHtmlRef.current = editorRef.current.innerHTML;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setEditHtml(editHtmlRef.current);
      }, 300);
    }
  }, []);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleEditorInput();
  }, [handleEditorInput]);

  const statusConfig = STATUS_CONFIG[article.reviewStatus] || STATUS_CONFIG.draft;
  const nextAction = NEXT_STATUS[article.reviewStatus];
  const currentStepIndex = STATUS_FLOW.indexOf(article.reviewStatus);

  const unresolvedComments = article.comments.filter((c) => !c.resolved);
  const resolvedComments = article.comments.filter((c) => c.resolved);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: newStatus }),
      });
      if (res.ok) onUpdate(await res.json());
    } catch {
      // Ignore
    } finally {
      setUpdating(false);
    }
  };

  const handleResetToStatus = async (targetStatus: string) => {
    setShowResetDropdown(false);
    setUpdating(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToStatus: targetStatus }),
      });
      if (res.ok) onUpdate(await res.json());
    } catch {
      // Ignore
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestRevision = async () => {
    setRequestingRevision(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}/request-revision`, {
        method: "POST",
      });
      if (res.ok) {
        const refreshRes = await fetch(`/api/content-reviews/${article.id}`);
        if (refreshRes.ok) onUpdate(await refreshRes.json());
        alert("Überarbeitung wurde angefordert. Der Autor wurde per E-Mail benachrichtigt.");
      } else {
        const data = await res.json();
        alert(data.error || "Fehler beim Anfordern der Überarbeitung");
      }
    } catch {
      alert("Fehler beim Anfordern der Überarbeitung");
    } finally {
      setRequestingRevision(false);
    }
  };

  const handleResolveRevision = async () => {
    setResolvingRevision(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolveRevision: true }),
      });
      if (res.ok) onUpdate(await res.json());
    } catch {
      // Ignore
    } finally {
      setResolvingRevision(false);
    }
  };

  const handleClaimToggle = async () => {
    setClaimUpdating(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: !isClaimed || !isClaimedByMe }),
      });
      if (res.ok) onUpdate(await res.json());
    } catch {
      // Ignore
    } finally {
      setClaimUpdating(false);
    }
  };

  const handleEloxxToggle = async () => {
    setEloxxUpdating(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eloxxImported: !article.eloxxImportedAt }),
      });
      if (res.ok) onUpdate(await res.json());
    } catch {
      // Ignore
    } finally {
      setEloxxUpdating(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedText.trim() || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/content-reviews/${article.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedText, commentText, role: commentRole, changeAndForward, recheckAfterRevision }),
      });
      if (res.ok) {
        const refreshRes = await fetch(`/api/content-reviews/${article.id}`);
        if (refreshRes.ok) onUpdate(await refreshRes.json());
        setSelectedText("");
        setCommentText("");
        setChangeAndForward(false);
        setRecheckAfterRevision(false);
        setShowCommentInput(false);
      }
    } catch {
      // Ignore
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    try {
      const res = await fetch(`/api/content-reviews/${article.id}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, resolved }),
      });
      if (res.ok) {
        const refreshRes = await fetch(`/api/content-reviews/${article.id}`);
        if (refreshRes.ok) onUpdate(await refreshRes.json());
      }
    } catch {
      // Ignore
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(
        `/api/content-reviews/${article.id}/comments?commentId=${commentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        const refreshRes = await fetch(`/api/content-reviews/${article.id}`);
        if (refreshRes.ok) onUpdate(await refreshRes.json());
      }
    } catch {
      // Ignore
    }
  };

  const handleTextSelection = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;
    const selection = iframeDoc.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 0) {
      setSelectedText(text);
      setShowCommentInput(true);
      setTimeout(() => commentInputRef.current?.focus(), 100);
    }
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const attachListener = () => {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;
      iframeDoc.addEventListener("mouseup", handleTextSelection);
    };

    iframe.addEventListener("load", attachListener);
    attachListener();

    return () => {
      iframe.removeEventListener("load", attachListener);
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.removeEventListener("mouseup", handleTextSelection);
      }
    };
  }, [handleTextSelection, article.htmlContent]);

  // Highlight selected text from a comment inside the iframe
  const highlightInIframe = useCallback((text: string, commentId: string) => {
    let targetDoc: Document;
    let rootEl: HTMLElement;

    if (isEditing && editorRef.current) {
      isHighlightingRef.current = true;
      targetDoc = document;
      rootEl = editorRef.current;
    } else {
      const iframe = iframeRef.current;
      if (!iframe) return;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return;
      targetDoc = iframeDoc;
      rootEl = iframeDoc.body;
    }

    // Remove previous highlights
    rootEl.querySelectorAll(".content-check-highlight").forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(targetDoc.createTextNode(el.textContent || ""), el);
        parent.normalize();
      }
    });

    if (activeCommentId === commentId) {
      setActiveCommentId(null);
      if (isEditing) {
        requestAnimationFrame(() => { isHighlightingRef.current = false; });
      }
      return;
    }

    setActiveCommentId(commentId);

    const walker = targetDoc.createTreeWalker(
      rootEl,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      const idx = (node.textContent || "").indexOf(text);
      if (idx >= 0) {
        const range = targetDoc.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + text.length);

        const mark = targetDoc.createElement("mark");
        mark.className = "content-check-highlight";
        mark.style.cssText = "background: #fbbf24; padding: 2px 0; border-radius: 2px; scroll-margin-top: 80px;";
        range.surroundContents(mark);
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }

    if (isEditing) {
      requestAnimationFrame(() => { isHighlightingRef.current = false; });
    }
  }, [activeCommentId, isEditing]);

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = 20;

    const STATUS_LABELS: Record<string, string> = {
      draft: "Entwurf",
      pm_review: "Produkt Management",
      brand_review: "Brand-Check",
      brand_approved: "Brand freigegeben",
      compliance_review: "Compliance Review",
      compliance_approved: "Compliance freigegeben",
      legal_review: "Legal Review",
      legal_approved: "Legal freigegeben",
      production_ready: "Production Ready",
      published: "Published",
    };

    const checkPageBreak = (needed: number) => {
      if (y + needed > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
    };

    // --- Titelseite ---
    y = 60;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("CONTENT REVIEW - REVISIONSARCHIV", margin, y);
    y += 16;

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(`#${article.contentNumber} ${article.title}`, contentWidth);
    for (const line of titleLines) {
      doc.text(line, margin, y);
      y += 10;
    }
    y += 8;

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + 40, y);
    y += 14;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const metaFields = [
      `Kategorie: ${article.category}`,
      `Funnel-Stage: ${article.funnelStage}`,
      `Zielgruppe: ${article.targetAudience}`,
      `Wortanzahl: ${article.wordCount}`,
      `Erstellt von: ${article.creator.name || article.creator.email}`,
      `Erstellt am: ${new Date(article.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
      `Status: ${STATUS_LABELS[article.reviewStatus] || article.reviewStatus}`,
    ];
    for (const field of metaFields) {
      doc.text(field, margin, y);
      y += 6;
    }

    // --- Artikelinhalt ---
    doc.addPage();
    y = 20;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Artikelinhalt", margin, y);
    y += 10;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // HTML-Tags entfernen und Text formatieren
    const plainText = article.htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "  - ")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<td[^>]*>/gi, " | ")
      .replace(/<th[^>]*>/gi, " | ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&ndash;/g, "-")
      .replace(/&mdash;/g, "-")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);

    const paragraphs = plainText.split("\n\n");
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      const lines = doc.splitTextToSize(trimmed, contentWidth);
      for (const line of lines) {
        checkPageBreak(5);
        doc.text(line, margin, y);
        y += 4.5;
      }
      y += 3;
    }

    // --- Kommentare ---
    if (article.comments.length > 0) {
      doc.addPage();
      y = 20;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Kommentare", margin, y);
      y += 10;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      for (const comment of article.comments) {
        checkPageBreak(30);

        // Rolle + Autor + Datum
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        const roleLabelMap: Record<string, string> = { compliance: "COMPLIANCE", legal: "LEGAL", produktmanagement: "PRODUKTMANAGEMENT", brand: "BRAND" };
        const roleLabel = roleLabelMap[comment.role] || comment.role.toUpperCase();
        const author = comment.author.name || comment.author.email;
        const date = new Date(comment.createdAt).toLocaleDateString("de-DE", {
          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
        const status = comment.resolved ? " [ERLEDIGT]" : " [OFFEN]";
        doc.text(`${roleLabel} | ${author} | ${date}${status}`, margin, y);
        y += 5;

        // Markierter Text
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(146, 64, 14);
        const selectedLines = doc.splitTextToSize(`"${comment.selectedText}"`, contentWidth);
        for (const line of selectedLines) {
          checkPageBreak(5);
          doc.text(line, margin, y);
          y += 4;
        }
        y += 2;

        // Kommentartext
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(30, 41, 59);
        const commentLines = doc.splitTextToSize(comment.commentText, contentWidth);
        for (const line of commentLines) {
          checkPageBreak(5);
          doc.text(line, margin, y);
          y += 4.5;
        }

        y += 4;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
      }
    }

    // --- Aenderungsverlauf ---
    doc.addPage();
    y = 20;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Aenderungsverlauf", margin, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Vollstaendige Dokumentation aller Statusaenderungen zu Revisionszwecken", margin, y);
    y += 8;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const history = article.statusHistory || [];

    if (history.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Keine Statusaenderungen protokolliert.", margin, y);
    } else {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y - 4, contentWidth, 8, "F");

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("DATUM / UHRZEIT", margin + 2, y);
      doc.text("AKTION", margin + 38, y);
      doc.text("STATUS", margin + 95, y);
      doc.text("VON", margin + 135, y);
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);

      for (const entry of history) {
        checkPageBreak(8);

        const entryDate = new Date(entry.createdAt).toLocaleDateString("de-DE", {
          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
        const changedBy = entry.changedByName || entry.changedByEmail;
        const statusLabel = STATUS_LABELS[entry.toStatus] || entry.toStatus;

        let actionLabel: string;
        let statusCol: string;

        switch (entry.comment) {
          case "revision_requested":
            actionLabel = "Ueberarb. angefordert";
            statusCol = STATUS_LABELS[entry.fromStatus] || entry.fromStatus;
            break;
          case "revision_resolved":
            actionLabel = "Ueberarbeitet";
            statusCol = STATUS_LABELS[entry.fromStatus] || entry.fromStatus;
            break;
          case "implicit_approval":
            actionLabel = "Freigegeben (o. Recheck)";
            statusCol = STATUS_LABELS[entry.fromStatus] || entry.fromStatus;
            break;
          case "status_reset":
            actionLabel = "Zurueckgesetzt";
            statusCol = `${STATUS_LABELS[entry.fromStatus] || entry.fromStatus} -> ${statusLabel}`;
            break;
          default:
            if (entry.toStatus.endsWith("_approved")) {
              actionLabel = "Freigegeben";
            } else {
              actionLabel = "Weitergereicht";
            }
            statusCol = `${STATUS_LABELS[entry.fromStatus] || entry.fromStatus} -> ${statusLabel}`;
            break;
        }

        doc.setFontSize(7.5);
        doc.text(entryDate, margin + 2, y);

        doc.text(actionLabel, margin + 38, y);

        const statusLines = doc.splitTextToSize(statusCol, 38);
        doc.text(statusLines[0], margin + 95, y);

        const nameLines = doc.splitTextToSize(changedBy, 32);
        doc.text(nameLines[0], margin + 135, y);

        y += 6;

        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.15);
        doc.line(margin, y - 2, pageWidth - margin, y - 2);
      }
    }

    // Footer auf jeder Seite
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(
        `SEO Dashboard - Content Review | ${article.title} | Seite ${i} von ${totalPages}`,
        margin,
        pageHeight - 10
      );
      doc.text(
        `Generiert am ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
        pageWidth - margin - 55,
        pageHeight - 10
      );
    }

    const slug = article.slug || article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    doc.save(`content-review-${slug}.pdf`);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append("images", file);
      }

      const res = await fetch(`/api/content-reviews/${article.id}/images`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setArticleImages((prev) => [...data.images, ...prev]);
      }
    } catch {
      // Ignore
    } finally {
      setUploadingImages(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const res = await fetch(
        `/api/content-reviews/${article.id}/images?imageId=${imageId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setArticleImages((prev) => prev.filter((img) => img.id !== imageId));
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
            <span className="text-slate-400 dark:text-slate-500 font-mono mr-2">#{article.contentNumber}</span>
            {article.title}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{article.funnelStage}</span>
            <span>{article.category}</span>
            <span>{article.targetAudience}</span>
            <span>{article.wordCount} Wörter</span>
          </div>
        </div>
      </div>

      {/* SEO Meta-Daten */}
      {(article.metaTitle || article.metaDescription || canEditContent) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">SEO Meta-Daten</p>
            <div className="flex items-center gap-2">
              {saveMetaSuccess && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Gespeichert
                </span>
              )}
              {canEditContent && !editingMeta && (
                <button
                  onClick={() => setEditingMeta(true)}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Bearbeiten
                </button>
              )}
            </div>
          </div>
          {editingMeta && canEditContent ? (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Title Tag</label>
                <input
                  type="text"
                  value={editMetaTitle}
                  onChange={(e) => setEditMetaTitle(e.target.value)}
                  placeholder="Title Tag eingeben..."
                  className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <span className={`text-[10px] ${editMetaTitle.length >= 50 && editMetaTitle.length <= 60 ? "text-emerald-500" : editMetaTitle.length === 0 ? "text-slate-400" : "text-amber-500"}`}>
                  {editMetaTitle.length} Zeichen {editMetaTitle.length > 0 && (editMetaTitle.length < 50 ? "(zu kurz, ideal: 50–60)" : editMetaTitle.length > 60 ? "(zu lang, ideal: 50–60)" : "(optimal)")}
                </span>
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Meta Description</label>
                <textarea
                  value={editMetaDescription}
                  onChange={(e) => setEditMetaDescription(e.target.value)}
                  placeholder="Meta Description eingeben..."
                  rows={2}
                  className="mt-0.5 w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
                <span className={`text-[10px] ${editMetaDescription.length >= 140 && editMetaDescription.length <= 160 ? "text-emerald-500" : editMetaDescription.length === 0 ? "text-slate-400" : "text-amber-500"}`}>
                  {editMetaDescription.length} Zeichen {editMetaDescription.length > 0 && (editMetaDescription.length < 140 ? "(zu kurz, ideal: 140–160)" : editMetaDescription.length > 160 ? "(zu lang, ideal: 140–160)" : "(optimal)")}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveMeta}
                  disabled={savingMeta}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingMeta ? "Speichere..." : "Speichern"}
                </button>
                <button
                  onClick={() => {
                    setEditingMeta(false);
                    setEditMetaTitle(article.metaTitle || "");
                    setEditMetaDescription(article.metaDescription || "");
                  }}
                  disabled={savingMeta}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {article.metaTitle && (
                <div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Title Tag</span>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium leading-snug mt-0.5">{article.metaTitle}</p>
                  <span className={`text-[10px] ${article.metaTitle.length >= 50 && article.metaTitle.length <= 60 ? "text-emerald-500" : "text-amber-500"}`}>
                    {article.metaTitle.length} Zeichen {article.metaTitle.length < 50 ? "(zu kurz, ideal: 50–60)" : article.metaTitle.length > 60 ? "(zu lang, ideal: 50–60)" : "(optimal)"}
                  </span>
                </div>
              )}
              {article.metaDescription && (
                <div>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Meta Description</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug mt-0.5">{article.metaDescription}</p>
                  <span className={`text-[10px] ${article.metaDescription.length >= 140 && article.metaDescription.length <= 160 ? "text-emerald-500" : "text-amber-500"}`}>
                    {article.metaDescription.length} Zeichen {article.metaDescription.length < 140 ? "(zu kurz, ideal: 140–160)" : article.metaDescription.length > 160 ? "(zu lang, ideal: 140–160)" : "(optimal)"}
                  </span>
                </div>
              )}
              {!article.metaTitle && !article.metaDescription && canEditContent && (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic col-span-2">Keine SEO Meta-Daten vorhanden – klicke &quot;Bearbeiten&quot; um welche hinzuzufügen.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status Progress Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((status, index) => {
            const config = STATUS_CONFIG[status];
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCompleted
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40"
                        : "bg-slate-200 dark:bg-slate-600 text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 text-center leading-tight ${isCurrent ? "font-semibold " + config.color : "text-slate-400 dark:text-slate-500"}`}>
                    {config.label}
                  </span>
                </div>
                {index < STATUS_FLOW.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-1 mt-[-16px] ${
                      isCompleted ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-600"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Revision Banner */}
        {hasOpenRevision && (
          <div className="flex items-center gap-3 mt-4 pt-3 pb-3 px-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Überarbeitung angefordert
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                von {article.revisionRequestedBy} am {new Date(article.revisionRequestedAt!).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} – Content kann nicht weitergereicht werden, bis die Überarbeitung als erledigt markiert wird.
              </p>
            </div>
            {canEditContent && (
              <button
                onClick={handleResolveRevision}
                disabled={resolvingRevision}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {resolvingRevision ? "Wird gespeichert..." : "Überarbeitung erledigt"}
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex-wrap">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
          {article.reviewStepDueAt && article.reviewStatus !== "published" && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                isReviewStepPastDue(new Date(article.reviewStepDueAt))
                  ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 ring-1 ring-red-200 dark:ring-red-800"
                  : "bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200"
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Frist aktueller Schritt: {formatReviewDueDateDe(article.reviewStepDueAt)}
              {isReviewStepPastDue(new Date(article.reviewStepDueAt)) ? " (überfällig)" : ""}
            </span>
          )}
          {/* Claim */}
          {article.reviewStatus !== "draft" && article.reviewStatus !== "published" && (
            isClaimedByOther ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {article.claimedByName} arbeitet daran
              </span>
            ) : (
              <button
                onClick={handleClaimToggle}
                disabled={claimUpdating}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                  isClaimedByMe
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isClaimedByMe ? "M5 13l4 4L19 7" : "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"} />
                </svg>
                {claimUpdating ? "..." : isClaimedByMe ? "Ich arbeite daran" : "Übernehmen"}
              </button>
            )
          )}
          <div className="flex-1" />
          {unresolvedComments.length > 0 && !canEditContent && !hasOpenRevision && article.reviewStatus !== "draft" && article.reviewStatus !== "published" && (
            <button
              onClick={handleRequestRevision}
              disabled={requestingRevision}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {requestingRevision ? "Wird gesendet..." : `Überarbeitung anfordern (${unresolvedComments.length})`}
            </button>
          )}
          {nextAction && (
            <button
              onClick={() => handleStatusChange(nextAction.status)}
              disabled={updating || hasOpenRevision}
              title={hasOpenRevision ? "Überarbeitung muss zuerst als erledigt markiert werden" : undefined}
              className={`px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 transition-colors ${hasOpenRevision ? "bg-slate-400 cursor-not-allowed" : nextAction.color}`}
            >
              {updating ? "Bitte warten..." : nextAction.label}
            </button>
          )}
          {currentStepIndex > 0 && article.reviewStatus !== "published" && (
            <div className="relative">
              <button
                onClick={() => setShowResetDropdown(!showResetDropdown)}
                disabled={updating}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Zurücksetzen an...
              </button>
              {showResetDropdown && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[220px]">
                  {STATUS_FLOW.slice(0, currentStepIndex).map((status) => {
                    const config = STATUS_CONFIG[status];
                    return (
                      <button
                        key={status}
                        onClick={() => handleResetToStatus(status)}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        ← {config.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {(article.reviewStatus === "production_ready" || article.reviewStatus === "published") && (
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Revisions-PDF
            </button>
          )}
          {(article.reviewStatus === "production_ready" || article.reviewStatus === "published") && (
            <label
              className={`flex items-center gap-2.5 px-4 py-2 rounded-lg border transition-colors cursor-pointer select-none ${
                article.eloxxImportedAt
                  ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              } ${eloxxUpdating ? "opacity-50 pointer-events-none" : ""}`}
            >
              <input
                type="checkbox"
                checked={!!article.eloxxImportedAt}
                onChange={handleEloxxToggle}
                disabled={eloxxUpdating}
                className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <div className="flex flex-col">
                <span className={`text-sm font-medium ${article.eloxxImportedAt ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"}`}>
                  In Eloxx importiert
                </span>
                {article.eloxxImportedAt && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-tight">
                    {article.eloxxImportedBy} &middot; {new Date(article.eloxxImportedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </label>
          )}
          {isAgentur && (
            <button
              onClick={async () => {
                if (!confirm("Artikel wirklich löschen? Alle Kommentare und die gesamte Status-Historie werden ebenfalls gelöscht.")) return;
                setDeleting(true);
                try {
                  await onDelete();
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {deleting ? "Lösche..." : "Löschen"}
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 xl:h-[calc(100vh-20rem)]">
        {/* Preview / Editor */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col xl:h-full">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {canEdit && isEditing ? (isHtmlView ? "HTML-Quellcode" : "Artikel bearbeiten") : "Artikel-Vorschau"}
              </h2>
              {canEdit && (
                <button
                  onClick={() => { setActiveCommentId(null); setIsEditing(!isEditing); setIsHtmlView(false); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                    isEditing
                      ? "border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isEditing ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" : "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"} />
                  </svg>
                  {isEditing ? "Vorschau" : "Bearbeiten"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canEdit && isEditing ? (
                <>
                  {saveSuccess && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Gespeichert
                    </span>
                  )}
                  {hasUnsavedChanges && !saveSuccess && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">Ungespeicherte Änderungen</span>
                  )}
                  <button
                    onClick={handleSaveContent}
                    disabled={saving || !hasUnsavedChanges}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Speichern...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Speichern
                      </>
                    )}
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500">Text markieren, um zu kommentieren</span>
              )}
            </div>
          </div>
          {/* Editor Toolbar */}
          {canEdit && isEditing && (
            <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 shrink-0">
              {!isHtmlView && (
                <>
                  <button onClick={() => execCommand("bold")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Fett">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>
                  </button>
                  <button onClick={() => execCommand("italic")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Kursiv">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                  </button>
                  <button onClick={() => execCommand("underline")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Unterstrichen">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
                  </button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1.5" />
                  <button onClick={() => execCommand("formatBlock", "h2")} className="px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors" title="Überschrift 2">
                    H2
                  </button>
                  <button onClick={() => execCommand("formatBlock", "h3")} className="px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors" title="Überschrift 3">
                    H3
                  </button>
                  <button onClick={() => execCommand("formatBlock", "p")} className="px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-xs text-slate-600 dark:text-slate-300 transition-colors" title="Absatz">
                    P
                  </button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1.5" />
                  <button onClick={() => execCommand("insertUnorderedList")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Aufzählung">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
                  </button>
                  <button onClick={() => execCommand("insertOrderedList")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Nummerierte Liste">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fontSize="8" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text><text x="2" y="14" fontSize="8" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text><text x="2" y="20" fontSize="8" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text></svg>
                  </button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1.5" />
                  <button onClick={() => execCommand("removeFormat")} className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Formatierung entfernen">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 10L3 10M21 6L3 6M15.5 14L3 14M11.5 18L3 18"/><line x1="19" y1="12" x2="13" y2="20" strokeWidth={2}/><line x1="13" y1="12" x2="19" y2="20" strokeWidth={2}/></svg>
                  </button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1.5" />
                </>
              )}
              <button
                onClick={() => {
                  if (!isHtmlView) {
                    setHtmlSource(editorRef.current?.innerHTML || editHtmlRef.current);
                  } else {
                    if (editorRef.current) {
                      editorRef.current.innerHTML = htmlSource;
                      editHtmlRef.current = htmlSource;
                      setEditHtml(htmlSource);
                    }
                  }
                  setIsHtmlView(!isHtmlView);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isHtmlView
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                    : "hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                }`}
                title={isHtmlView ? "Zurück zum visuellen Editor" : "HTML-Quellcode bearbeiten"}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                {isHtmlView ? "Visual" : "HTML"}
              </button>
            </div>
          )}
          <div className="flex-1 min-h-[500px] xl:min-h-0 relative">
            {canEdit && isEditing ? (
              isHtmlView ? (
                <textarea
                  value={htmlSource}
                  onChange={(e) => {
                    setHtmlSource(e.target.value);
                    editHtmlRef.current = e.target.value;
                    setEditHtml(e.target.value);
                  }}
                  className="absolute inset-0 w-full h-full p-4 font-mono text-sm text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 border-0 resize-none focus:outline-none focus:ring-0"
                  spellCheck={false}
                />
              ) : (
                <ContentEditor
                  editorRef={editorRef}
                  initialHtml={article.htmlContent}
                  onInput={handleEditorInput}
                  onInitialized={(cleanHtml) => {
                    cleanedOriginalRef.current = cleanHtml;
                    editHtmlRef.current = cleanHtml;
                    setEditHtml(cleanHtml);
                  }}
                />
              )
            ) : (
              <iframe
                ref={iframeRef}
                srcDoc={article.htmlContent}
                className="w-full h-full absolute inset-0 border-0"
                sandbox="allow-same-origin"
                title="Artikel-Vorschau"
                onLoad={() => {
                  const doc = iframeRef.current?.contentDocument;
                  if (!doc) return;
                  doc.addEventListener("click", (e) => {
                    const anchor = (e.target as HTMLElement).closest("a");
                    if (!anchor) return;
                    const href = anchor.getAttribute("href");
                    if (href?.startsWith("#")) {
                      e.preventDefault();
                      const target = doc.querySelector(href) || doc.getElementById(href.slice(1));
                      target?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  });
                }}
              />
            )}
          </div>
        </div>

        {/* Comments Sidebar */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col xl:h-full">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Kommentare ({article.comments.length})
              </h2>
              <div className="flex gap-1 flex-wrap">
                {([
                  { key: "produktmanagement", label: "ProduktMgmt", activeBg: "bg-cyan-100 dark:bg-cyan-900/40", activeText: "text-cyan-700 dark:text-cyan-300" },
                  { key: "brand", label: "Brand", activeBg: "bg-rose-100 dark:bg-rose-900/40", activeText: "text-rose-700 dark:text-rose-300" },
                  { key: "compliance", label: "Compliance", activeBg: "bg-amber-100 dark:bg-amber-900/40", activeText: "text-amber-700 dark:text-amber-300" },
                  { key: "legal", label: "Legal", activeBg: "bg-purple-100 dark:bg-purple-900/40", activeText: "text-purple-700 dark:text-purple-300" },
                ] as const).map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setCommentRole(r.key)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      commentRole === r.key
                        ? `${r.activeBg} ${r.activeText} font-medium`
                        : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* New comment input */}
          {showCommentInput && selectedText && (
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 shrink-0">
              <div className="mb-2">
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                  COMMENT_ROLE_STYLES[commentRole]
                }`}>
                  {COMMENT_ROLE_LABELS[commentRole]}
                </span>
              </div>
              <div className="p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 mb-2">
                <p className="text-xs text-yellow-800 dark:text-yellow-300 italic line-clamp-3">
                  &bdquo;{selectedText}&ldquo;
                </p>
              </div>
              <textarea
                ref={commentInputRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Änderungswunsch oder Kommentar..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                rows={3}
              />
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={changeAndForward}
                    onChange={(e) => setChangeAndForward(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-1"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors">
                    Ändern und weitergeben
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={recheckAfterRevision}
                    onChange={(e) => setRecheckAfterRevision(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-1"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors">
                    Recheck nach Überarbeitung
                  </span>
                </label>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || submittingComment}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submittingComment ? "Sende..." : "Kommentar senden"}
                </button>
                <button
                  onClick={() => {
                    setShowCommentInput(false);
                    setSelectedText("");
                    setCommentText("");
                    setChangeAndForward(false);
                    setRecheckAfterRevision(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Comment list */}
          <div className="flex-1 overflow-y-auto">
            {article.comments.length === 0 && articleImages.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Noch keine Kommentare.
                <br />
                <span className="text-xs">Text im Artikel markieren, um zu kommentieren.</span>
              </div>
            ) : (
              <div>
                {unresolvedComments.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Offen ({unresolvedComments.length})
                    </div>
                    {unresolvedComments.map((c) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        isActive={activeCommentId === c.id}
                        onHighlight={() => highlightInIframe(c.selectedText, c.id)}
                        onResolve={() => handleResolveComment(c.id, true)}
                        onDelete={() => handleDeleteComment(c.id)}
                      />
                    ))}
                  </div>
                )}
                {resolvedComments.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Erledigt ({resolvedComments.length})
                    </div>
                    {resolvedComments.map((c) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        isActive={activeCommentId === c.id}
                        onHighlight={() => highlightInIframe(c.selectedText, c.id)}
                        onResolve={() => handleResolveComment(c.id, false)}
                        onDelete={() => handleDeleteComment(c.id)}
                        resolved
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Vorgeschlagene Bilder */}
            <div className="border-t border-slate-200 dark:border-slate-700">
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Vorgeschlagene Bilder ({articleImages.length})
                </span>
                {isAgentur && (
                  <label className={`cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium normal-case transition-colors ${uploadingImages ? "opacity-50 pointer-events-none" : ""}`}>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImages}
                    />
                    {uploadingImages ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Hochladen...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Bild hinzufügen
                      </span>
                    )}
                  </label>
                )}
              </div>

              {articleImages.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                  {isAgentur ? "Noch keine Bilder vorgeschlagen. Klicke oben auf \"Bild hinzufügen\"." : "Noch keine Bilder vorgeschlagen."}
                </div>
              ) : (
                <div className="p-3 grid grid-cols-2 gap-2">
                  {articleImages.map((img) => (
                    <div key={img.id} className="group relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
                      <button
                        onClick={() => setImagePreview(img.fileUrl)}
                        className="block w-full"
                      >
                        <img
                          src={img.fileUrl}
                          alt={img.fileName}
                          className="w-full h-24 object-cover"
                        />
                      </button>
                      <div className="p-1.5">
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate" title={img.fileName}>
                          {img.fileName}
                        </p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500">
                          {img.uploadedBy.name || img.uploadedBy.email} &middot; {new Date(img.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                        </p>
                      </div>
                      {isAgentur && (
                        <button
                          onClick={() => handleDeleteImage(img.id)}
                          className="absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                          title="Bild entfernen"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
          onClick={() => setImagePreview(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={imagePreview} alt="Vorschau" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <a
              href={imagePreview}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute -bottom-3 right-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Vollbild öffnen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ContentEditor: Prevents React from overwriting contentEditable DOM on re-render ---

function ContentEditor({
  editorRef,
  initialHtml,
  onInput,
  onInitialized,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  initialHtml: string;
  onInput: () => void;
  onInitialized?: (cleanHtml: string) => void;
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(initialHtml, "text/html");

      doc.querySelectorAll("style").forEach((el) => el.remove());
      doc.querySelectorAll("script").forEach((el) => el.remove());

      // Only strip color-related inline styles to fix contrast; keep layout styles intact
      doc.querySelectorAll("[style]").forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.removeProperty("color");
        htmlEl.style.removeProperty("background-color");
        htmlEl.style.removeProperty("background");
        if (!htmlEl.getAttribute("style")?.trim()) {
          htmlEl.removeAttribute("style");
        }
      });

      const cleanHtml = doc.body.innerHTML;
      editorRef.current.innerHTML = cleanHtml;
      initialized.current = true;

      onInitialized?.(cleanHtml);
    }
  }, [editorRef, initialHtml, onInitialized]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={onInput}
      onBlur={onInput}
      className="content-editor-area absolute inset-0 overflow-y-auto p-6 max-w-none focus:outline-none"
    />
  );
}

// --- Comment Item ---

function CommentItem({
  comment,
  isActive,
  onHighlight,
  onResolve,
  onDelete,
  resolved = false,
}: {
  comment: ArticleComment;
  isActive: boolean;
  onHighlight: () => void;
  onResolve: () => void;
  onDelete: () => void;
  resolved?: boolean;
}) {
  const roleStyle = COMMENT_ROLE_STYLES[comment.role] || COMMENT_ROLE_STYLES.compliance;
  const roleLabel = COMMENT_ROLE_LABELS[comment.role] || comment.role;

  return (
    <div
      className={`px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 transition-colors cursor-pointer ${
        isActive ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
      } ${resolved ? "opacity-60" : ""}`}
      onClick={onHighlight}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${roleStyle}`}>
            {roleLabel}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {comment.author.name || comment.author.email}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {new Date(comment.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="p-1.5 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 mb-1.5">
        <p className="text-[11px] text-yellow-800 dark:text-yellow-300 italic line-clamp-2">
          &bdquo;{comment.selectedText}&ldquo;
        </p>
      </div>
      <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">
        {comment.commentText}
      </p>
      {(comment.changeAndForward || comment.recheckAfterRevision) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {comment.changeAndForward && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              Ändern &amp; weitergeben
            </span>
          )}
          {comment.recheckAfterRevision && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Recheck nach Überarbeitung
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onResolve}
          className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
            resolved
              ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          }`}
        >
          {resolved ? "Wieder öffnen" : "Als erledigt markieren"}
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] font-medium px-2 py-0.5 rounded text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          Löschen
        </button>
      </div>
    </div>
  );
}
