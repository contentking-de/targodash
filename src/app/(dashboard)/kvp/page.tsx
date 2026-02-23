"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { getAuthenticatedBlobUrl } from "@/lib/blob-url";
import { PieChart } from "@/components/charts";
import { canEdit } from "@/lib/rbac";

interface SimpleUser {
  id: string;
  name: string | null;
  email: string;
}

interface KVPAssignee {
  id: string;
  kvpUrlId: string;
  userId: string;
  createdAt: string;
  user: SimpleUser;
}

interface KVPSubkeyword {
  id: string;
  keyword: string;
  createdAt: string;
  updatedAt: string;
}

interface KVPComment {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface KVPFile {
  id: string;
  urlId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

interface MaturityItem {
  id: string;
  category: string;
  title: string;
  score: number;
  maturityId: string;
  maturityName: string;
}

interface MaturityLink {
  id: string;
  kvpUrlId: string;
  maturityItemId: string;
  createdAt: string;
  maturityItem: {
    id: string;
    category: string;
    title: string;
    score: number;
    maturity: {
      id: string;
      name: string;
    };
  };
}

interface KVPUrl {
  id: string;
  url: string;
  focusKeyword: string;
  category?: string | null;
  comment?: string | null; // Deprecated, wird durch comments ersetzt
  subkeywords: KVPSubkeyword[];
  comments: KVPComment[];
  files?: KVPFile[];
  maturityLinks?: MaturityLink[];
  assignees?: KVPAssignee[]; // Zugewiesene Nutzer
  createdAt: string;
  updatedAt: string;
}

const KEYWORD_CATEGORIES = [
  "Mortgages",
  "Accounts&Cards",
  "Investing",
  "Pension",
  "Digital Banking",
] as const;

interface Ranking {
  keyword: string;
  position: number | null;
  url: string | null;
  date: string;
}

// Funktion zum Formatieren von Dateigrößen
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// Icon-Komponente für Dateitypen
const getFileIcon = (fileType: string): string => {
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType === "application/pdf") return "📄";
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("csv")) return "📊";
  if (fileType.includes("document") || fileType.includes("word")) return "📝";
  if (fileType.includes("presentation") || fileType.includes("powerpoint")) return "📈";
  if (fileType.includes("zip") || fileType.includes("rar") || fileType.includes("tar")) return "📦";
  return "📎";
};

// Funktion zum Formatieren von Datum und Uhrzeit
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function KVPPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const canEditData = canEdit(session?.user?.role);
  const [urls, setUrls] = useState<KVPUrl[]>([]);
  const [rankings, setRankings] = useState<Record<string, Ranking[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "workload">("overview");
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [newFocusKeyword, setNewFocusKeyword] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newComment, setNewComment] = useState("");
  const [newSubkeywords, setNewSubkeywords] = useState<string[]>([]);
  const [newSubkeywordInput, setNewSubkeywordInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [focusKeywordFilter, setFocusKeywordFilter] = useState<string>("");
  const [allMaturityItems, setAllMaturityItems] = useState<MaturityItem[]>([]);
  const [maturityLinks, setMaturityLinks] = useState<Record<string, MaturityLink[]>>({});
  const [editingMaturityLinks, setEditingMaturityLinks] = useState<string | null>(null);
  const [selectedMaturityItems, setSelectedMaturityItems] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");

  useEffect(() => {
    fetchUrls();
    fetchAllMaturityItems();
    fetchAllUsers();
  }, []);

  const fetchAllUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      setAllUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Update search text from URL params
  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setSearchText(searchFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    // Lade Rankings und Maturity Links für alle URLs
    urls.forEach((url) => {
      fetchRankings(url.id);
      fetchMaturityLinks(url.id);
    });
  }, [urls]);

  const fetchAllMaturityItems = async () => {
    try {
      const response = await fetch("/api/seo-maturity/items");
      const data = await response.json();
      setAllMaturityItems(data.items || []);
    } catch (error) {
      console.error("Error fetching maturity items:", error);
    }
  };

  const fetchMaturityLinks = async (urlId: string) => {
    try {
      const response = await fetch(`/api/kvp/${urlId}/maturity-links`);
      const data = await response.json();
      if (data.links) {
        setMaturityLinks((prev) => ({
          ...prev,
          [urlId]: data.links,
        }));
      }
    } catch (error) {
      console.error("Error fetching maturity links:", error);
    }
  };

  const handleUpdateMaturityLinks = async (urlId: string) => {
    try {
      const response = await fetch(`/api/kvp/${urlId}/maturity-links`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maturityItemIds: selectedMaturityItems }),
      });

      const data = await response.json();
      if (data.links) {
        setMaturityLinks((prev) => ({
          ...prev,
          [urlId]: data.links,
        }));
      }
      setEditingMaturityLinks(null);
      setSelectedMaturityItems([]);
    } catch (error) {
      console.error("Error updating maturity links:", error);
      alert("Fehler beim Speichern der Verknüpfungen");
    }
  };

  const startEditingMaturityLinks = (urlId: string) => {
    const currentLinks = maturityLinks[urlId] || [];
    setSelectedMaturityItems(currentLinks.map((l) => l.maturityItemId));
    setEditingMaturityLinks(urlId);
  };

  const fetchUrls = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/kvp");
      const data = await response.json();
      setUrls(data.urls || []);
    } catch (error) {
      console.error("Error fetching KVP URLs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRankings = async (urlId: string) => {
    try {
      const response = await fetch(`/api/kvp/${urlId}/rankings`);
      const data = await response.json();
      if (data.rankings) {
        setRankings((prev) => ({
          ...prev,
          [urlId]: data.rankings,
        }));
      }
    } catch (error) {
      console.error("Error fetching rankings:", error);
    }
  };

  const getRankingForKeyword = (urlId: string, keyword: string): Ranking | null => {
    const urlRankings = rankings[urlId] || [];
    return urlRankings.find((r) => r.keyword === keyword) || null;
  };

  const handleCreateUrl = async () => {
    if (!newUrl.trim() || !newFocusKeyword.trim()) {
      alert("URL und Fokuskeyword sind erforderlich");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/kvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          focusKeyword: newFocusKeyword.trim(),
          category: newCategory || null,
          comment: newComment.trim() || null,
          subkeywords: newSubkeywords.filter((k) => k.trim()),
          assigneeIds: newAssigneeIds,
        }),
      });

      const data = await response.json();
      if (data.url) {
        const newUrls = [data.url, ...urls];
        setUrls(newUrls);
        setShowNewForm(false);
        resetForm();
        // Lade Rankings für die neue URL
        await fetchRankings(data.url.id);
      }
    } catch (error) {
      console.error("Error creating KVP URL:", error);
      alert("Fehler beim Erstellen der URL");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUrl = async (id: string, url: string, focusKeyword: string, category: string, comment: string, assigneeIds?: string[]) => {
    try {
      const response = await fetch(`/api/kvp/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          focusKeyword: focusKeyword.trim(),
          category: category || null,
          comment: comment.trim() || null,
          ...(assigneeIds !== undefined && { assigneeIds }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Fehler beim Aktualisieren");
      }

      const data = await response.json();
      if (data.url) {
        setUrls(urls.map((u) => (u.id === id ? data.url : u)));
        setEditingId(null);
        // Lade Rankings neu, falls sich Keywords geändert haben
        await fetchRankings(id);
      } else {
        throw new Error("Keine Daten erhalten");
      }
    } catch (error) {
      console.error("Error updating KVP URL:", error);
      alert(`Fehler beim Aktualisieren der URL: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  };

  const handleDeleteUrl = async (id: string) => {
    if (!confirm("Möchten Sie diese URL wirklich löschen?")) {
      return;
    }

    try {
      const response = await fetch(`/api/kvp/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUrls(urls.filter((u) => u.id !== id));
      }
    } catch (error) {
      console.error("Error deleting KVP URL:", error);
      alert("Fehler beim Löschen der URL");
    }
  };

  const handleAddSubkeyword = async (urlId: string, keyword: string) => {
    if (!keyword.trim()) return;

    try {
      const response = await fetch(`/api/kvp/${urlId}/subkeywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      const data = await response.json();
      if (data.subkeyword) {
        const updatedUrls = urls.map((u) =>
          u.id === urlId
            ? { ...u, subkeywords: [...u.subkeywords, data.subkeyword] }
            : u
        );
        setUrls(updatedUrls);
        
        // Füge das neue Keyword auch zum Ranktracker hinzu
        const url = updatedUrls.find((u) => u.id === urlId);
        if (url) {
          await addKeywordToRankTracker(keyword.trim(), url.url);
          // Lade Rankings neu
          await fetchRankings(urlId);
        }
      }
    } catch (error) {
      console.error("Error adding subkeyword:", error);
      alert("Fehler beim Hinzufügen des Subkeywords");
    }
  };

  const addKeywordToRankTracker = async (keyword: string, targetUrl: string) => {
    try {
      const response = await fetch("/api/rank-tracker/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: keyword.trim(),
          targetUrl: targetUrl.trim(),
        }),
      });

      if (!response.ok) {
        // Ignoriere Fehler wenn Keyword bereits existiert
        const error = await response.json();
        if (error.error !== "Keyword existiert bereits") {
          console.error("Error adding keyword to rank tracker:", error);
        }
      }
    } catch (error) {
      console.error("Error adding keyword to rank tracker:", error);
    }
  };

  const handleStartEditingComment = (urlId: string, commentId?: string, currentComment?: string | null) => {
    if (commentId && currentComment) {
      // Bestehenden Kommentar bearbeiten
      setEditingCommentId(commentId);
    } else {
      // Neuen Kommentar hinzufügen
      setEditingCommentId(`new-${urlId}`);
    }
    setCommentText(currentComment || "");
  };

  const handleCancelEditingComment = () => {
    setEditingCommentId(null);
    setCommentText("");
  };

  const handleSaveComment = async (urlId: string, commentId?: string) => {
    try {
      if (commentId) {
        // Kommentar aktualisieren
        const response = await fetch(`/api/kvp/comments/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: commentText.trim(),
          }),
        });

        if (!response.ok) {
          throw new Error("Fehler beim Speichern");
        }

        const data = await response.json();
        if (data.comment) {
          setUrls(
            urls.map((u) =>
              u.id === urlId
                ? {
                    ...u,
                    comments: u.comments.map((c) =>
                      c.id === commentId ? data.comment : c
                    ),
                  }
                : u
            )
          );
          setEditingCommentId(null);
          setCommentText("");
        }
      } else {
        // Neuen Kommentar hinzufügen
        const text = newCommentText[urlId] || commentText;
        if (!text.trim()) return;

        const response = await fetch(`/api/kvp/${urlId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
          }),
        });

        if (!response.ok) {
          throw new Error("Fehler beim Speichern");
        }

        const data = await response.json();
        if (data.comment) {
          setUrls(
            urls.map((u) =>
              u.id === urlId
                ? { ...u, comments: [...u.comments, data.comment] }
                : u
            )
          );
          setNewCommentText({ ...newCommentText, [urlId]: "" });
          setCommentText("");
        }
      }
    } catch (error) {
      console.error("Error saving comment:", error);
      alert("Fehler beim Speichern des Kommentars");
    }
  };

  const handleDeleteComment = async (urlId: string, commentId: string) => {
    try {
      const response = await fetch(`/api/kvp/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Fehler beim Löschen");
      }

      setUrls(
        urls.map((u) =>
          u.id === urlId
            ? { ...u, comments: u.comments.filter((c) => c.id !== commentId) }
            : u
        )
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Fehler beim Löschen des Kommentars");
    }
  };

  const handleDeleteSubkeyword = async (urlId: string, subkeywordId: string) => {
    try {
      const response = await fetch(`/api/kvp/subkeywords/${subkeywordId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUrls(
          urls.map((u) =>
            u.id === urlId
              ? {
                  ...u,
                  subkeywords: u.subkeywords.filter((s) => s.id !== subkeywordId),
                }
              : u
          )
        );
      }
    } catch (error) {
      console.error("Error deleting subkeyword:", error);
      alert("Fehler beim Löschen des Subkeywords");
    }
  };

  const handleUploadFiles = async (urlId: string, files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(`/api/kvp/${urlId}/files`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload fehlgeschlagen");
      }

      const data = await response.json();
      if (data.files) {
        // Aktualisiere den KVP mit den neuen Dateien
        setUrls(
          urls.map((u) =>
            u.id === urlId
              ? { ...u, files: [...(u.files || []), ...data.files] }
              : u
          )
        );
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      alert(`Fehler beim Hochladen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    }
  };

  const handleDeleteFile = async (urlId: string, fileId: string) => {
    if (!confirm("Datei wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/kvp/${urlId}/files?fileId=${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Fehler beim Löschen");
      }

      setUrls(
        urls.map((u) =>
          u.id === urlId
            ? { ...u, files: (u.files || []).filter((f) => f.id !== fileId) }
            : u
        )
      );
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Fehler beim Löschen der Datei");
    }
  };

  const resetForm = () => {
    setNewUrl("");
    setNewFocusKeyword("");
    setNewCategory("");
    setNewComment("");
    setNewSubkeywords([]);
    setNewSubkeywordInput("");
    setNewAssigneeIds([]);
  };

  const addSubkeywordToForm = () => {
    if (newSubkeywordInput.trim()) {
      setNewSubkeywords([...newSubkeywords, newSubkeywordInput.trim()]);
      setNewSubkeywordInput("");
    }
  };

  const removeSubkeywordFromForm = (index: number) => {
    setNewSubkeywords(newSubkeywords.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SEO KVP</h1>
        <div className="h-64 bg-white dark:bg-slate-800 rounded-xl animate-pulse border border-slate-200 dark:border-slate-700"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SEO KVP</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Kontinuierlicher Verbesserungsprozess
          </p>
        </div>
        {activeTab === "overview" && canEditData && (
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {showNewForm ? "Abbrechen" : "Neue URL hinzufügen"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "overview"
                ? "text-slate-900 dark:text-white border-b-2 border-blue-500"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Übersicht
          </button>
          <button
            onClick={() => setActiveTab("analysis")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "analysis"
                ? "text-slate-900 dark:text-white border-b-2 border-blue-500"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Auswertung
          </button>
          <button
            onClick={() => setActiveTab("workload")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "workload"
                ? "text-slate-900 dark:text-white border-b-2 border-blue-500"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Workload
          </button>
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <>
              {showNewForm && canEditData && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 mb-6">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                    Neue URL hinzufügen
                  </h2>
                  <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                URL *
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/page"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Fokuskeyword *
              </label>
              <input
                type="text"
                value={newFocusKeyword}
                onChange={(e) => setNewFocusKeyword(e.target.value)}
                placeholder="Hauptkeyword für diese URL"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Kategorie
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="">Keine Kategorie</option>
                {KEYWORD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Kommentar
              </label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Optionale Notizen oder Kommentare..."
                rows={3}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Subkeywords
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newSubkeywordInput}
                  onChange={(e) => setNewSubkeywordInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSubkeywordToForm();
                    }
                  }}
                  placeholder="Subkeyword eingeben und Enter drücken"
                  className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
                <button
                  onClick={addSubkeywordToForm}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Hinzufügen
                </button>
              </div>
              {newSubkeywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newSubkeywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg text-sm"
                    >
                      {keyword}
                      <button
                        onClick={() => removeSubkeywordFromForm(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Verantwortliche Personen
              </label>
              <div className="space-y-2">
                {allUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={newAssigneeIds.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewAssigneeIds([...newAssigneeIds, user.id]);
                        } else {
                          setNewAssigneeIds(newAssigneeIds.filter((id) => id !== user.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-900 dark:text-white">
                      {user.name || user.email}
                    </span>
                    {user.name && (
                      <span className="text-xs text-slate-500 dark:text-slate-500">
                        ({user.email})
                      </span>
                    )}
                  </label>
                ))}
              </div>
              {newAssigneeIds.length > 0 && (
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {newAssigneeIds.length} Person{newAssigneeIds.length !== 1 ? "en" : ""} ausgewählt
                </div>
              )}
            </div>
            <button
              onClick={handleCreateUrl}
              disabled={isSaving || !newUrl.trim() || !newFocusKeyword.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {isSaving ? "Erstelle..." : "Erstellen"}
            </button>
          </div>
        </div>
      )}

              {/* Such- und Filter-Bereich */}
              {(() => {
                // Alle eindeutigen Fokuskeywords sammeln und alphabetisch sortieren
                const uniqueFocusKeywords = Array.from(
                  new Set(urls.map((url) => url.focusKeyword))
                ).sort((a, b) => a.localeCompare(b, "de"));

                // Filterlogik einmal berechnen
                const filteredUrls = urls.filter((url) => {
                  // Kategorie-Filter
                  if (categoryFilter) {
                    if (categoryFilter === "__no_category__" && url.category) return false;
                    if (categoryFilter !== "__no_category__" && url.category !== categoryFilter) return false;
                  }
                  // Fokuskeyword-Filter
                  if (focusKeywordFilter) {
                    if (url.focusKeyword !== focusKeywordFilter) return false;
                  }
                  // Verantwortliche-Filter
                  if (assigneeFilter) {
                    if (assigneeFilter === "__no_assignee__") {
                      if (url.assignees && url.assignees.length > 0) return false;
                    } else {
                      if (!url.assignees || !url.assignees.some((a) => a.userId === assigneeFilter)) return false;
                    }
                  }
                  // Suchtext-Filter
                  if (searchText) {
                    const searchLower = searchText.toLowerCase();
                    const matchesUrl = url.url.toLowerCase().includes(searchLower);
                    const matchesFocusKeyword = url.focusKeyword.toLowerCase().includes(searchLower);
                    const matchesSubkeywords = url.subkeywords.some((sub) =>
                      sub.keyword.toLowerCase().includes(searchLower)
                    );
                    const matchesAssignee = url.assignees?.some((a) =>
                      (a.user.name?.toLowerCase().includes(searchLower)) ||
                      a.user.email.toLowerCase().includes(searchLower)
                    );
                    if (!matchesUrl && !matchesFocusKeyword && !matchesSubkeywords && !matchesAssignee) return false;
                  }
                  return true;
                });

                return (
                  <>
                    <div className="mb-6 space-y-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Suchfeld */}
                        <div className="flex-1">
                          <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Suche nach URL oder Keyword..."
                            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {/* Kategorie-Filter */}
                        <div className="sm:w-64">
                          <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Alle Kategorien</option>
                            {KEYWORD_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                            <option value="__no_category__">Keine Kategorie</option>
                          </select>
                        </div>
                        {/* Fokuskeyword-Filter */}
                        <div className="sm:w-64">
                          <select
                            value={focusKeywordFilter}
                            onChange={(e) => setFocusKeywordFilter(e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Alle Fokuskeywords</option>
                            {uniqueFocusKeywords.map((keyword) => (
                              <option key={keyword} value={keyword}>
                                {keyword}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Verantwortliche-Filter */}
                        <div className="sm:w-64">
                          <select
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value)}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Alle Verantwortlichen</option>
                            <option value="__no_assignee__">Keine Zuweisung</option>
                            {allUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name || user.email}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Filter zurücksetzen */}
                        {(searchText || categoryFilter || focusKeywordFilter || assigneeFilter) && (
                          <button
                            onClick={() => {
                              setSearchText("");
                              setCategoryFilter("");
                              setFocusKeywordFilter("");
                              setAssigneeFilter("");
                            }}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors whitespace-nowrap"
                          >
                            Filter zurücksetzen
                          </button>
                        )}
                      </div>
                      {/* Anzahl gefilterter Ergebnisse */}
                      {filteredUrls.length !== urls.length && (
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {filteredUrls.length} von {urls.length} URLs gefunden
                        </div>
                      )}
                    </div>

                    {urls.length === 0 ? (
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-slate-600 dark:text-slate-400">
                          {canEditData 
                            ? "Noch keine URLs erfasst. Erstellen Sie Ihre erste URL."
                            : "Noch keine URLs erfasst."}
                        </p>
                      </div>
                    ) : filteredUrls.length === 0 ? (
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center">
                        <p className="text-slate-600 dark:text-slate-400">
                          Keine URLs gefunden, die den Filterkriterien entsprechen.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredUrls.map((url) => (
            <div
              key={url.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700"
            >
              {editingId === url.id ? (
                <EditUrlForm
                  url={urls.find((u) => u.id === url.id) || url}
                  allUsers={allUsers}
                  onSave={(updatedUrl, focusKeyword, category, comment, assigneeIds) => {
                    handleUpdateUrl(url.id, updatedUrl, focusKeyword, category, comment, assigneeIds);
                  }}
                  onCancel={() => setEditingId(null)}
                  onAddSubkeyword={async (keyword) => {
                    await handleAddSubkeyword(url.id, keyword);
                    // Aktualisiere die URL-Liste, um die neuen Subkeywords zu zeigen
                    const updatedUrls = await fetch("/api/kvp").then((r) => r.json());
                    if (updatedUrls.urls) {
                      setUrls(updatedUrls.urls);
                      // Aktualisiere auch die Rankings
                      await fetchRankings(url.id);
                    }
                  }}
                  onDeleteSubkeyword={async (subkeywordId) => {
                    await handleDeleteSubkeyword(url.id, subkeywordId);
                    // Aktualisiere die URL-Liste
                    const updatedUrls = await fetch("/api/kvp").then((r) => r.json());
                    if (updatedUrls.urls) {
                      setUrls(updatedUrls.urls);
                      // Aktualisiere auch die Rankings
                      await fetchRankings(url.id);
                    }
                  }}
                  onUploadFiles={(files) => handleUploadFiles(url.id, files)}
                  onDeleteFile={(fileId) => handleDeleteFile(url.id, fileId)}
                />
              ) : (
                <>
                  <div className="relative mb-4">
                    {/* Datum und Icons oben */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          Erstellt: {formatDateTime(url.createdAt)}
                        </span>
                        {url.updatedAt !== url.createdAt && (
                          <span className="text-xs text-slate-600 whitespace-nowrap">
                            Aktualisiert: {formatDateTime(url.updatedAt)}
                          </span>
                        )}
                      </div>
                      {/* Edit und Delete Icons oben rechts */}
                      {canEditData && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingId(url.id)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Bearbeiten"
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteUrl(url.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Löschen"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Inhalt - volle Breite */}
                    <div>
                      <div className="mb-2">
                                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white break-all">
                                          {url.url}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                          {url.category && (
                                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                              Kategorie: {url.category}
                                            </span>
                                          )}
                                          {url.assignees && url.assignees.length > 0 && (
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs text-slate-500 dark:text-slate-500">•</span>
                                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                                Verantwortlich:
                                              </span>
                                              <div className="flex flex-wrap gap-1">
                                                {url.assignees.map((assignee) => (
                                                  <span
                                                    key={assignee.id}
                                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                                    title={assignee.user.email}
                                                  >
                                                    {assignee.user.name || assignee.user.email}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                          {(!url.assignees || url.assignees.length === 0) && (
                                            <span className="text-xs text-orange-600 dark:text-orange-400 italic">
                                              Keine Zuweisung
                                            </span>
                                          )}
                                        </div>
                                      </div>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-400">
                            Kommentare ({url.comments?.length || 0})
                          </span>
                        </div>
                        
                        {/* Bestehende Kommentare */}
                        {url.comments && url.comments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {url.comments.map((comment) => (
                              <div key={comment.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                                {editingCommentId === comment.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={commentText}
                                      onChange={(e) => setCommentText(e.target.value)}
                                      placeholder="Kommentar eingeben..."
                                      rows={3}
                                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
                                      autoFocus
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleSaveComment(url.id, comment.id)}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                                      >
                                        Speichern
                                      </button>
                                      <button
                                        onClick={handleCancelEditingComment}
                                        className="px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm rounded transition-colors"
                                      >
                                        Abbrechen
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="group">
                                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                      {comment.text}
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-xs text-slate-500 dark:text-slate-500">
                                        {formatDateTime(comment.createdAt)}
                                      </span>
                                      {canEditData && (
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={() => handleStartEditingComment(url.id, comment.id, comment.text)}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                          >
                                            Bearbeiten
                                          </button>
                                          <button
                                            onClick={() => handleDeleteComment(url.id, comment.id)}
                                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                          >
                                            Löschen
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Neuen Kommentar hinzufügen */}
                        {canEditData && editingCommentId === `new-${url.id}` ? (
                          <div className="space-y-2">
                            <textarea
                              value={newCommentText[url.id] || ""}
                              onChange={(e) =>
                                setNewCommentText({
                                  ...newCommentText,
                                  [url.id]: e.target.value,
                                })
                              }
                              placeholder="Neuen Kommentar eingeben..."
                              rows={3}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveComment(url.id)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                              >
                                Hinzufügen
                              </button>
                              <button
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setNewCommentText({ ...newCommentText, [url.id]: "" });
                                }}
                                className="px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm rounded transition-colors"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        ) : canEditData ? (
                          <button
                            onClick={() => setEditingCommentId(`new-${url.id}`)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                          >
                            + Neuen Kommentar hinzufügen
                          </button>
                        ) : null}
                      </div>

                      {/* Dateien */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-400">
                            Dateien ({url.files?.length || 0})
                          </span>
                        </div>
                        
                        {/* Bestehende Dateien anzeigen */}
                        {url.files && url.files.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {url.files.map((file) => (
                              <div
                                key={file.id}
                                className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg group"
                              >
                                <a
                                  href={getAuthenticatedBlobUrl(file.fileUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 flex-1 min-w-0 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <span className="text-lg flex-shrink-0">{getFileIcon(file.fileType)}</span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm text-slate-900 dark:text-white block truncate">
                                      {file.fileName}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-500">
                                      {formatFileSize(file.fileSize)} • {formatDateTime(file.createdAt)}
                                    </span>
                                  </div>
                                </a>
                                {canEditData && (
                                  <button
                                    onClick={() => handleDeleteFile(url.id, file.id)}
                                    className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                                    title="Datei löschen"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Datei-Upload */}
                        {canEditData && (
                          <FileUploadArea
                            kvpId={url.id}
                            onUpload={(files) => handleUploadFiles(url.id, files)}
                          />
                        )}
                      </div>

                      {/* SEO-Reifegrad-Verknüpfungen */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-400">
                            SEO-Reifegrad Verknüpfungen ({maturityLinks[url.id]?.length || 0})
                          </span>
                          {canEditData && editingMaturityLinks !== url.id && (
                            <button
                              onClick={() => startEditingMaturityLinks(url.id)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                            >
                              Bearbeiten
                            </button>
                          )}
                        </div>

                        {editingMaturityLinks === url.id ? (
                          <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Wähle die SEO-Reifegradpunkte aus, auf die dieser KVP einzahlt:
                            </p>
                            <div className="max-h-64 overflow-y-auto space-y-2">
                              {/* Gruppiere nach Kategorie */}
                              {Array.from(new Set(allMaturityItems.map((item) => item.category))).map((category) => (
                                <div key={category} className="space-y-1">
                                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 sticky top-0 bg-slate-50 dark:bg-slate-900 py-1">
                                    {category}
                                  </div>
                                  {allMaturityItems
                                    .filter((item) => item.category === category)
                                    .map((item) => (
                                      <label
                                        key={item.id}
                                        className="flex items-start gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedMaturityItems.includes(item.id)}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedMaturityItems([...selectedMaturityItems, item.id]);
                                            } else {
                                              setSelectedMaturityItems(selectedMaturityItems.filter((id) => id !== item.id));
                                            }
                                          }}
                                          className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <span className="text-sm text-slate-900 dark:text-white block">
                                            {item.title}
                                          </span>
                                          <span className="text-xs text-slate-500 dark:text-slate-500">
                                            {item.maturityName} • Score: {item.score}/10
                                          </span>
                                        </div>
                                      </label>
                                    ))}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                              <button
                                onClick={() => handleUpdateMaturityLinks(url.id)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                              >
                                Speichern ({selectedMaturityItems.length} ausgewählt)
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMaturityLinks(null);
                                  setSelectedMaturityItems([]);
                                }}
                                className="px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm rounded transition-colors"
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {maturityLinks[url.id] && maturityLinks[url.id].length > 0 ? (
                              <div className="space-y-1">
                                {maturityLinks[url.id].map((link) => (
                                  <div
                                    key={link.id}
                                    className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded text-sm"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <span className="text-slate-900 dark:text-white block truncate">
                                        {link.maturityItem.title}
                                      </span>
                                      <span className="text-xs text-slate-500 dark:text-slate-500">
                                        {link.maturityItem.category} • {link.maturityItem.maturity.name}
                                      </span>
                                    </div>
                                    <span
                                      className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                                        link.maturityItem.score <= 3
                                          ? "bg-red-500 text-white"
                                          : link.maturityItem.score <= 5
                                          ? "bg-orange-500 text-white"
                                          : link.maturityItem.score <= 7
                                          ? "bg-blue-500 text-white"
                                          : "bg-green-500 text-white"
                                      }`}
                                    >
                                      {link.maturityItem.score}/10
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 dark:text-slate-500 italic">
                                Keine Verknüpfungen vorhanden
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mb-4">
                        <div className="space-y-0 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                          {/* Fokuskeyword - fett */}
                          <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {url.focusKeyword}
                            </span>
                            {(() => {
                              const ranking = getRankingForKeyword(url.id, url.focusKeyword);
                              if (ranking) {
                                return (
                                  <span className={`text-xs px-2 py-1 rounded flex-shrink-0 w-12 text-center ${
                                    ranking.position === null 
                                      ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400" 
                                      : ranking.position <= 10 
                                      ? "bg-green-600 text-white" 
                                      : ranking.position <= 30 
                                      ? "bg-yellow-600 text-white" 
                                      : "bg-red-600 text-white"
                                  }`}>
                                    {ranking.position === null ? "N/A" : ranking.position}
                                  </span>
                                );
                              }
                              return <span className="w-12"></span>;
                            })()}
                          </div>
                          
                          {/* Subkeywords - eingerückt und normal */}
                          {url.subkeywords.length > 0 && (
                            <div className="divide-y divide-slate-200 dark:divide-slate-700">
                              {url.subkeywords.map((subkeyword, index) => {
                                const ranking = getRankingForKeyword(url.id, subkeyword.keyword);
                                return (
                                  <div
                                    key={subkeyword.id}
                                    className="flex items-center justify-between gap-4 px-4 py-2 pl-6 group"
                                    title={`Hinzugefügt: ${formatDateTime(subkeyword.createdAt)}`}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-sm text-slate-700 dark:text-slate-300">
                                        {subkeyword.keyword}
                                      </span>
                                      <span className="text-xs text-slate-500 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        ({formatDateTime(subkeyword.createdAt)})
                                      </span>
                                      {canEditData && (
                                        <button
                                          onClick={() =>
                                            handleDeleteSubkeyword(url.id, subkeyword.id)
                                          }
                                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 w-12 text-center ${
                                      ranking && ranking.position !== null
                                        ? ranking.position <= 10 
                                          ? "bg-green-600 text-white" 
                                          : ranking.position <= 30 
                                          ? "bg-yellow-600 text-white" 
                                          : "bg-red-600 text-white"
                                        : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                                    }`}>
                                      {ranking ? (ranking.position === null ? "N/A" : ranking.position) : "-"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {canEditData && (
                          <div className="mt-3">
                            <AddSubkeywordForm
                              urlId={url.id}
                              onAdd={(keyword) => handleAddSubkeyword(url.id, keyword)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {activeTab === "analysis" && (
            <AnalysisView urls={urls} rankings={rankings} getRankingForKeyword={getRankingForKeyword} />
          )}

          {activeTab === "workload" && (
            <WorkloadView urls={urls} />
          )}
        </div>
      </div>
    </div>
  );
}

function AnalysisView({
  urls,
  rankings,
  getRankingForKeyword,
}: {
  urls: KVPUrl[];
  rankings: Record<string, Ranking[]>;
  getRankingForKeyword: (urlId: string, keyword: string) => Ranking | null;
}) {
  // Berechne Kategorieverteilung
  const categoryDistribution = urls.reduce((acc, url) => {
    const category = url.category || "Keine Kategorie";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(categoryDistribution).map(([name, value]) => ({
    name,
    value,
  }));

  // Sammle alle Rankings für die Übersicht
  const allRankings: Array<{
    url: string;
    keyword: string;
    category: string | null;
    position: number | null;
    urlId: string;
  }> = [];

  urls.forEach((url) => {
    // Fokuskeyword
    const focusRanking = getRankingForKeyword(url.id, url.focusKeyword);
    allRankings.push({
      url: url.url,
      keyword: url.focusKeyword,
      category: url.category || null,
      position: focusRanking?.position ?? null,
      urlId: url.id,
    });

    // Subkeywords
    url.subkeywords.forEach((subkeyword) => {
      const subRanking = getRankingForKeyword(url.id, subkeyword.keyword);
      allRankings.push({
        url: url.url,
        keyword: subkeyword.keyword,
        category: url.category || null,
        position: subRanking?.position ?? null,
        urlId: url.id,
      });
    });
  });

  // Sortiere nach Position (beste zuerst, dann N/A)
  const sortedRankings = [...allRankings].sort((a, b) => {
    if (a.position === null && b.position === null) return 0;
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });

  // Statistiken
  const totalKeywords = allRankings.length;
  const keywordsWithRanking = allRankings.filter((r) => r.position !== null).length;
  const top10Keywords = allRankings.filter((r) => r.position !== null && r.position <= 10).length;
  const top30Keywords = allRankings.filter((r) => r.position !== null && r.position <= 30).length;

  return (
    <div className="space-y-6">
      {/* Statistiken */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">Gesamt Keywords</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalKeywords}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">Mit Ranking</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{keywordsWithRanking}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">Top 10</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{top10Keywords}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">Top 30</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{top30Keywords}</div>
        </div>
      </div>

      {/* Kategorieverteilung */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Kategorieverteilung</h2>
        {categoryData.length > 0 ? (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <PieChart data={categoryData} height={300} />
            </div>
            <div className="flex-1">
              <div className="space-y-2">
                {categoryData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{
                          backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][
                            index % 5
                          ],
                        }}
                      />
                      <span className="text-slate-900 dark:text-white font-medium">{item.name}</span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-600 dark:text-slate-400">Keine Kategorien vorhanden</p>
        )}
      </div>

      {/* Rankings-Übersicht */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Rankings-Übersicht</h2>
        {sortedRankings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Keyword</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">URL</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Kategorie</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Position</th>
                </tr>
              </thead>
              <tbody>
                {sortedRankings.map((ranking, index) => (
                  <tr
                    key={`${ranking.urlId}-${ranking.keyword}-${index}`}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="text-slate-900 dark:text-white">{ranking.keyword}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-600 dark:text-slate-400 text-sm truncate max-w-xs block">
                        {ranking.url}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-600 dark:text-slate-400 text-sm">
                        {ranking.category || "Keine"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {ranking.position !== null ? (
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            ranking.position <= 10
                              ? "bg-green-600 text-white"
                              : ranking.position <= 30
                              ? "bg-yellow-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {ranking.position}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-500 text-xs">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-600 dark:text-slate-400">Keine Rankings vorhanden</p>
        )}
      </div>
    </div>
  );
}

function WorkloadView({ urls }: { urls: KVPUrl[] }) {
  // Sortiere URLs nach Erstellungsdatum (neueste zuerst)
  const sortedUrls = [...urls].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Berechne Gesamtstatistiken
  const totalUrls = urls.length;
  const totalComments = urls.reduce((sum, url) => sum + (url.comments?.length || 0), 0);
  const urlsWithComments = urls.filter((url) => (url.comments?.length || 0) > 0).length;
  const urlsWithAssignees = urls.filter((url) => (url.assignees?.length || 0) > 0).length;
  const urlsWithoutAssignees = urls.filter((url) => !(url.assignees?.length)).length;

  // Gruppiere URLs nach Verantwortlichen
  const urlsByAssignee = urls.reduce((acc, url) => {
    if (!url.assignees || url.assignees.length === 0) {
      const key = "__no_assignee__";
      if (!acc[key]) acc[key] = { name: "Nicht zugewiesen", email: "", urls: [] };
      acc[key].urls.push(url);
    } else {
      url.assignees.forEach((assignee) => {
        const key = assignee.userId;
        if (!acc[key]) acc[key] = { name: assignee.user.name || assignee.user.email, email: assignee.user.email, urls: [] };
        acc[key].urls.push(url);
      });
    }
    return acc;
  }, {} as Record<string, { name: string; email: string; urls: KVPUrl[] }>);

  // Gruppiere URLs nach Monat
  const urlsByMonth = urls.reduce((acc, url) => {
    const date = new Date(url.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    acc[monthKey] = (acc[monthKey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Gruppiere Kommentare nach Monat
  const commentsByMonth = urls.reduce((acc, url) => {
    url.comments?.forEach((comment) => {
      const date = new Date(comment.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      acc[monthKey] = (acc[monthKey] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Statistiken */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">Gesamt URLs</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalUrls}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">Gesamt Kommentare</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalComments}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">URLs mit Kommentaren</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{urlsWithComments}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">Mit Verantwortlichen</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{urlsWithAssignees}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-400">Ohne Zuweisung</div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{urlsWithoutAssignees}</div>
        </div>
      </div>

      {/* Workload nach Verantwortlichen */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Workload nach Verantwortlichen</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(urlsByAssignee)
            .sort((a, b) => b[1].urls.length - a[1].urls.length)
            .map(([key, data]) => (
              <div
                key={key}
                className={`p-4 rounded-lg border ${
                  key === "__no_assignee__"
                    ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${
                    key === "__no_assignee__"
                      ? "text-orange-700 dark:text-orange-400"
                      : "text-slate-900 dark:text-white"
                  }`}>
                    {data.name}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-sm font-bold ${
                    key === "__no_assignee__"
                      ? "bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200"
                      : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                  }`}>
                    {data.urls.length}
                  </span>
                </div>
                {data.email && key !== "__no_assignee__" && (
                  <div className="text-xs text-slate-500 dark:text-slate-500 mb-2">{data.email}</div>
                )}
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {data.urls.slice(0, 5).map((url) => (
                    <div key={url.id} className="text-xs text-slate-600 dark:text-slate-400 truncate" title={url.url}>
                      {url.focusKeyword}
                    </div>
                  ))}
                  {data.urls.length > 5 && (
                    <div className="text-xs text-slate-500 dark:text-slate-500 italic">
                      +{data.urls.length - 5} weitere
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* URLs-Übersicht */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">URLs und Kommentare</h2>
        {sortedUrls.length > 0 ? (
          <div className="space-y-4">
            {sortedUrls.map((url) => {
              const commentCount = url.comments?.length || 0;
              const sortedComments = [...(url.comments || [])].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );

              return (
                <div key={url.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white break-all mb-1">{url.url}</h3>
                      <div className="flex flex-wrap items-center gap-4 mt-2">
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          <span className="font-medium">Angelegt:</span> {formatDateTime(url.createdAt)}
                        </div>
                        {url.updatedAt !== url.createdAt && (
                          <div className="text-xs text-slate-500 dark:text-slate-500">
                            <span className="font-medium">Aktualisiert:</span> {formatDateTime(url.updatedAt)}
                          </div>
                        )}
                        {url.assignees && url.assignees.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500 dark:text-slate-500">Verantwortlich:</span>
                            <div className="flex flex-wrap gap-1">
                              {url.assignees.map((a) => (
                                <span
                                  key={a.id}
                                  className="px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                >
                                  {a.user.name || a.user.email}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-orange-600 dark:text-orange-400 italic">Keine Zuweisung</span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                        {commentCount} {commentCount === 1 ? "Kommentar" : "Kommentare"}
                      </span>
                    </div>
                  </div>

                  {commentCount > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-400 mb-2">Kommentare:</div>
                      <div className="space-y-2">
                        {sortedComments.map((comment) => (
                          <div key={comment.id} className="bg-white dark:bg-slate-900 rounded p-2">
                            <p className="text-xs text-slate-700 dark:text-slate-300 mb-1">{comment.text}</p>
                            <div className="text-xs text-slate-500 dark:text-slate-500">
                              {formatDateTime(comment.createdAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-600 dark:text-slate-400">Keine URLs vorhanden</p>
        )}
      </div>

      {/* Monatliche Übersicht */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Monatliche Übersicht</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">URLs angelegt</h3>
            <div className="space-y-2">
              {Object.entries(urlsByMonth)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([month, count]) => (
                  <div key={month} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="text-sm text-slate-900 dark:text-white">
                      {new Date(month + "-01").toLocaleDateString("de-DE", {
                        year: "numeric",
                        month: "long",
                      })}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{count}</span>
                  </div>
                ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Kommentare erstellt</h3>
            <div className="space-y-2">
              {Object.entries(commentsByMonth)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([month, count]) => (
                  <div key={month} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="text-sm text-slate-900 dark:text-white">
                      {new Date(month + "-01").toLocaleDateString("de-DE", {
                        year: "numeric",
                        month: "long",
                      })}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{count}</span>
                  </div>
                ))}
              {Object.keys(commentsByMonth).length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-500">Keine Kommentare vorhanden</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditUrlForm({
  url,
  allUsers,
  onSave,
  onCancel,
  onAddSubkeyword,
  onDeleteSubkeyword,
  onUploadFiles,
  onDeleteFile,
}: {
  url: KVPUrl;
  allUsers: SimpleUser[];
  onSave: (url: string, focusKeyword: string, category: string, comment: string, assigneeIds: string[]) => void;
  onCancel: () => void;
  onAddSubkeyword: (keyword: string) => Promise<void>;
  onDeleteSubkeyword: (subkeywordId: string) => Promise<void>;
  onUploadFiles: (files: FileList | File[]) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
}) {
  const [editUrl, setEditUrl] = useState(url.url);
  const [editFocusKeyword, setEditFocusKeyword] = useState(url.focusKeyword);
  const [editCategory, setEditCategory] = useState(url.category || "");
  const [editComment, setEditComment] = useState(url.comment || "");
  const [editSubkeywords, setEditSubkeywords] = useState<KVPSubkeyword[]>(url.subkeywords);
  const [newSubkeywordInput, setNewSubkeywordInput] = useState("");
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>(
    url.assignees?.map((a) => a.userId) || []
  );

  const handleAddSubkeyword = async () => {
    if (!newSubkeywordInput.trim()) return;
    try {
      await onAddSubkeyword(newSubkeywordInput.trim());
      // Lade Subkeywords neu - wird durch Parent-Komponente aktualisiert
      setNewSubkeywordInput("");
    } catch (error) {
      console.error("Error adding subkeyword:", error);
    }
  };

  const handleDeleteSubkeyword = async (subkeywordId: string) => {
    try {
      await onDeleteSubkeyword(subkeywordId);
      // Entferne aus lokaler Liste
      setEditSubkeywords(editSubkeywords.filter((s) => s.id !== subkeywordId));
    } catch (error) {
      console.error("Error deleting subkeyword:", error);
    }
  };

  // Aktualisiere Subkeywords wenn sich die URL ändert
  useEffect(() => {
    setEditSubkeywords(url.subkeywords);
  }, [url.subkeywords]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          URL *
        </label>
        <input
          type="url"
          value={editUrl}
          onChange={(e) => setEditUrl(e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Fokuskeyword *
        </label>
        <input
          type="text"
          value={editFocusKeyword}
          onChange={(e) => setEditFocusKeyword(e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Kategorie
        </label>
        <select
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="">Keine Kategorie</option>
          {KEYWORD_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Kommentar
        </label>
        <textarea
          value={editComment}
          onChange={(e) => setEditComment(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Keywords
        </label>
        <div className="space-y-2 mb-3">
          {/* Fokuskeyword - fett */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-blue-400">
              {editFocusKeyword || "(Fokuskeyword wird oben eingegeben)"}
            </span>
          </div>
          
          {/* Subkeywords - eingerückt und normal */}
          {editSubkeywords.length > 0 && (
            <div className="pl-4 space-y-1">
              {editSubkeywords.map((subkeyword) => (
                <div
                  key={subkeyword.id}
                  className="flex items-center gap-2 group"
                >
                  <span className="text-sm text-slate-300">
                    {subkeyword.keyword}
                  </span>
                  <button
                    onClick={() => handleDeleteSubkeyword(subkeyword.id)}
                    className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubkeywordInput}
            onChange={(e) => setNewSubkeywordInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubkeyword();
              }
            }}
            placeholder="Subkeyword eingeben und Enter drücken"
            className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
          />
          <button
            onClick={handleAddSubkeyword}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Hinzufügen
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Dateien ({url.files?.length || 0})
        </label>
        {/* Bestehende Dateien */}
        {url.files && url.files.length > 0 && (
          <div className="space-y-2 mb-3">
            {url.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded-lg group"
              >
                <a
                  href={getAuthenticatedBlobUrl(file.fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 flex-1 min-w-0 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <span className="text-lg flex-shrink-0">{getFileIcon(file.fileType)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-900 dark:text-white block truncate">
                      {file.fileName}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">
                      {formatFileSize(file.fileSize)} • {formatDateTime(file.createdAt)}
                    </span>
                  </div>
                </a>
                <button
                  onClick={() => onDeleteFile(file.id)}
                  className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                  title="Datei löschen"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Upload-Bereich */}
        <FileUploadArea
          kvpId={url.id}
          onUpload={onUploadFiles}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Verantwortliche Personen
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          {allUsers.map((user) => (
            <label
              key={user.id}
              className="flex items-center gap-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={editAssigneeIds.includes(user.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setEditAssigneeIds([...editAssigneeIds, user.id]);
                  } else {
                    setEditAssigneeIds(editAssigneeIds.filter((id) => id !== user.id));
                  }
                }}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-900 dark:text-white">
                {user.name || user.email}
              </span>
              {user.name && (
                <span className="text-xs text-slate-500 dark:text-slate-500">
                  ({user.email})
                </span>
              )}
            </label>
          ))}
        </div>
        {editAssigneeIds.length > 0 && (
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {editAssigneeIds.length} Person{editAssigneeIds.length !== 1 ? "en" : ""} ausgewählt
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(editUrl, editFocusKeyword, editCategory, editComment, editAssigneeIds)}
          disabled={!editUrl.trim() || !editFocusKeyword.trim()}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          Speichern
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function FileUploadArea({
  kvpId,
  onUpload,
}: {
  kvpId: string;
  onUpload: (files: FileList | File[]) => Promise<void>;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(e.target.files);
      } finally {
        setIsUploading(false);
        // Input zurücksetzen damit gleiche Datei erneut hochgeladen werden kann
        e.target.value = "";
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(e.dataTransfer.files);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        isDragOver
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
      }`}
    >
      {isUploading ? (
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-slate-600 dark:text-slate-400">Wird hochgeladen...</span>
        </div>
      ) : (
        <>
          <label className="cursor-pointer">
            <div className="flex flex-col items-center gap-1">
              <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Dateien hierher ziehen oder <span className="text-blue-600 dark:text-blue-400 underline">auswählen</span>
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-500">
                Max. 10 MB · PDF, DOCX, XLSX, PPTX, PNG, JPG, GIF, WebP
              </span>
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </>
      )}
    </div>
  );
}

function AddSubkeywordForm({
  urlId,
  onAdd,
}: {
  urlId: string;
  onAdd: (keyword: string) => void;
}) {
  const [keyword, setKeyword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      onAdd(keyword);
      setKeyword("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Subkeyword..."
        className="px-3 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
      />
      <button
        type="submit"
        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
      >
        Hinzufügen
      </button>
    </form>
  );
}
