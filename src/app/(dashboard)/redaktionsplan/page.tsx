"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { getAuthenticatedBlobUrl } from "@/lib/blob-url";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface EntryFile {
  id: string;
  entryId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

interface EditorialEntry {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  category: string | null;
  status: string;
  dueDate: string;
  creatorId: string;
  creator: User;
  assignees: User[];
  files: EntryFile[];
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  "Konto & Karten",
  "Kredit & Finanzierung",
  "Sparen & Investieren",
  "Schutz & Vorsorge",
];

const STATUS_OPTIONS = [
  { value: "planned", label: "Geplant", color: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300" },
  { value: "in_progress", label: "In Bearbeitung", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  { value: "review", label: "Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "published", label: "Veröffentlicht", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Konto & Karten": "border-l-blue-500",
  "Kredit & Finanzierung": "border-l-green-500",
  "Sparen & Investieren": "border-l-purple-500",
  "Schutz & Vorsorge": "border-l-orange-500",
};

function getStatusConfig(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getFileIcon = (fileType: string): string => {
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType === "application/pdf") return "📄";
  if (fileType.includes("spreadsheet") || fileType.includes("excel")) return "📊";
  if (fileType.includes("document") || fileType.includes("word")) return "📝";
  if (fileType.includes("presentation") || fileType.includes("powerpoint")) return "📈";
  return "📎";
};

function FileUploadArea({ onUpload }: { onUpload: (files: FileList) => Promise<void> }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      try {
        await onUpload(e.target.files);
      } finally {
        setIsUploading(false);
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

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
      className={`relative border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
        isDragOver
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
      }`}
    >
      {isUploading ? (
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-slate-600 dark:text-slate-400">Wird hochgeladen...</span>
        </div>
      ) : (
        <label className="cursor-pointer">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Dateien hierher ziehen oder <span className="text-blue-600 dark:text-blue-400 underline">auswählen</span>
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-500">Max. 10 MB · PDF, DOC, DOCX, XLSX, PPTX, PNG, JPG</span>
          <input type="file" multiple accept=".pdf,.doc,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.gif,.webp" onChange={handleFileChange} className="hidden" />
        </label>
      )}
    </div>
  );
}

export default function RedaktionsplanPage() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [entries, setEntries] = useState<EditorialEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditorialEntry | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formStatus, setFormStatus] = useState("planned");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAssigneeIds, setFormAssigneeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/editorial-plan");
      const data = await res.json();
      if (data.entries) setEntries(data.entries);
    } catch (error) {
      console.error("Error fetching entries:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchUsers();
  }, [fetchEntries, fetchUsers]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filterStatus !== "all" && e.status !== filterStatus) return false;
      if (filterCategory !== "all" && e.category !== filterCategory) return false;
      return true;
    });
  }, [entries, filterStatus, filterCategory]);

  const entriesByDate = useMemo(() => {
    const map: Record<string, EditorialEntry[]> = {};
    filteredEntries.forEach((entry) => {
      const dateKey = entry.dueDate.slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(entry);
    });
    return map;
  }, [filteredEntries]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  function goToToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  }

  function openCreateModal(dateStr?: string) {
    setEditingEntry(null);
    setFormTitle("");
    setFormDescription("");
    setFormUrl("");
    setFormCategory("");
    setFormStatus("planned");
    setFormDueDate(dateStr || new Date().toISOString().slice(0, 10));
    setFormAssigneeIds([]);
    setShowModal(true);
  }

  function openEditModal(entry: EditorialEntry) {
    setEditingEntry(entry);
    setFormTitle(entry.title);
    setFormDescription(entry.description || "");
    setFormUrl(entry.url || "");
    setFormCategory(entry.category || "");
    setFormStatus(entry.status);
    setFormDueDate(entry.dueDate.slice(0, 10));
    setFormAssigneeIds(entry.assignees.map((a) => a.id));
    setShowModal(true);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formDueDate) return;
    setSaving(true);

    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        url: formUrl.trim() || null,
        category: formCategory || null,
        status: formStatus,
        dueDate: formDueDate,
        assigneeIds: formAssigneeIds,
      };

      if (editingEntry) {
        const res = await fetch(`/api/editorial-plan/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setEntries((prev) =>
            prev.map((e) => (e.id === data.entry.id ? data.entry : e))
          );
        }
      } else {
        const res = await fetch("/api/editorial-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setEntries((prev) => [...prev, data.entry]);
        }
      }

      setShowModal(false);
    } catch (error) {
      console.error("Error saving entry:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eintrag wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/editorial-plan/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setShowModal(false);
        setSelectedDay(null);
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
    }
  }

  async function handleStatusChange(entry: EditorialEntry, newStatus: string) {
    try {
      const res = await fetch(`/api/editorial-plan/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries((prev) =>
          prev.map((e) => (e.id === data.entry.id ? data.entry : e))
        );
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  }

  function toggleAssignee(userId: string) {
    setFormAssigneeIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  async function handleFileUpload(entryId: string, fileList: FileList) {
    const formData = new FormData();
    Array.from(fileList).forEach((file) => formData.append("files", file));

    try {
      const res = await fetch(`/api/editorial-plan/${entryId}/files`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const updater = (e: EditorialEntry) =>
          e.id === entryId ? { ...e, files: [...data.files, ...e.files] } : e;
        setEntries((prev) => prev.map(updater));
        if (editingEntry?.id === entryId) {
          setEditingEntry((prev) => prev ? updater(prev) : prev);
        }
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    }
  }

  async function handleFileDelete(entryId: string, fileId: string) {
    try {
      const res = await fetch(`/api/editorial-plan/${entryId}/files?fileId=${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const updater = (e: EditorialEntry) =>
          e.id === entryId ? { ...e, files: e.files.filter((f) => f.id !== fileId) } : e;
        setEntries((prev) => prev.map(updater));
        if (editingEntry?.id === entryId) {
          setEditingEntry((prev) => prev ? updater(prev) : prev);
        }
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  }

  // Build calendar grid
  const calendarCells: { day: number | null; dateStr: string | null }[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push({ day: null, dateStr: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(currentMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    calendarCells.push({ day: d, dateStr: `${currentYear}-${m}-${dd}` });
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Redaktionsplan</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kalenderübersicht für Content-Planung und Themensteuerung
          </p>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Eintrag
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
        >
          <option value="all">Alle Status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
        >
          <option value="all">Alle Kategorien</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 ml-auto">
          <span className="font-medium">Legende:</span>
          {STATUS_OPTIONS.map((s) => (
            <span key={s.value} className={`px-2 py-0.5 rounded ${s.color} text-xs`}>{s.label}</span>
          ))}
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white min-w-[180px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button
          onClick={goToToday}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          Heute
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {calendarCells.map((cell, idx) => {
            const dayEntries = cell.dateStr ? (entriesByDate[cell.dateStr] || []) : [];
            const isToday = cell.dateStr === todayStr;
            const isSelected = cell.dateStr === selectedDay;
            const isPast = cell.dateStr ? cell.dateStr < todayStr : false;

            return (
              <div
                key={idx}
                className={`min-h-[110px] border-b border-r border-slate-100 dark:border-slate-700/50 p-1.5 transition-colors cursor-pointer ${
                  cell.day === null
                    ? "bg-slate-50/50 dark:bg-slate-900/30"
                    : isSelected
                      ? "bg-blue-50/50 dark:bg-blue-900/10"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                } ${isPast && cell.day !== null ? "opacity-70" : ""}`}
                onClick={() => {
                  if (cell.dateStr) {
                    setSelectedDay(cell.dateStr === selectedDay ? null : cell.dateStr);
                  }
                }}
                onDoubleClick={() => {
                  if (cell.dateStr) openCreateModal(cell.dateStr);
                }}
              >
                {cell.day !== null && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                          isToday
                            ? "bg-blue-600 text-white"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayEntries.length > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                          {dayEntries.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayEntries.slice(0, 3).map((entry) => {
                        const statusCfg = getStatusConfig(entry.status);
                        const borderColor = CATEGORY_COLORS[entry.category || ""] || "border-l-slate-400";
                        return (
                          <button
                            key={entry.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(entry);
                            }}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] leading-tight truncate border-l-2 ${borderColor} ${statusCfg.color} hover:opacity-80 transition-opacity`}
                            title={entry.title}
                          >
                            {entry.title}
                          </button>
                        );
                      })}
                      {dayEntries.length > 3 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1.5">
                          +{dayEntries.length - 3} weitere
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail panel */}
      {selectedDay && entriesByDate[selectedDay] && entriesByDate[selectedDay].length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {new Date(selectedDay + "T00:00:00").toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h3>
            <button
              onClick={() => openCreateModal(selectedDay)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Neuer Eintrag
            </button>
          </div>
          <div className="space-y-3">
            {entriesByDate[selectedDay].map((entry) => {
              const statusCfg = getStatusConfig(entry.status);
              const borderColor = CATEGORY_COLORS[entry.category || ""] || "border-l-slate-400";
              return (
                <div
                  key={entry.id}
                  className={`border-l-4 ${borderColor} bg-slate-50 dark:bg-slate-900/50 rounded-r-lg p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-colors`}
                  onClick={() => openEditModal(entry)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-900 dark:text-white truncate">{entry.title}</h4>
                      {entry.description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{entry.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        {entry.category && (
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {entry.category}
                          </span>
                        )}
                        {entry.assignees.length > 0 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {entry.assignees.map((a) => a.name || a.email).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <select
                      value={entry.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(entry, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming entries list */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Anstehende Einträge</h3>
        {filteredEntries.filter((e) => e.status !== "published").length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Keine anstehenden Einträge.</p>
        ) : (
          <div className="space-y-2">
            {filteredEntries
              .filter((e) => e.status !== "published")
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              .map((entry) => {
                const statusCfg = getStatusConfig(entry.status);
                const borderColor = CATEGORY_COLORS[entry.category || ""] || "border-l-slate-400";
                const isOverdue = entry.dueDate.slice(0, 10) < todayStr;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border-l-4 ${borderColor} bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-colors`}
                    onClick={() => openEditModal(entry)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-slate-900 dark:text-white truncate block">{entry.title}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${isOverdue ? "text-red-600 dark:text-red-400 font-semibold" : "text-slate-500 dark:text-slate-400"}`}>
                          {isOverdue && "⚠ "}
                          {new Date(entry.dueDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </span>
                        {entry.assignees.length > 0 && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            · {entry.assignees.map((a) => a.name || a.email).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    <select
                      value={entry.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(entry, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingEntry ? "Eintrag bearbeiten" : "Neuer Eintrag"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="z.B. Ratgeber Baufinanzierung"
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="Kurze Beschreibung des Themas..."
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL (optional)
                </label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category + Due Date Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Kategorie
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Keine Kategorie</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Fertigstellung *
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Status (only for editing) */}
              {editingEntry && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setFormStatus(s.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          formStatus === s.value
                            ? `${s.color} ring-2 ring-offset-1 ring-blue-500`
                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignees */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Zugewiesen an
                </label>
                <div className="flex flex-wrap gap-2">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => toggleAssignee(user.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                        formAssigneeIds.includes(user.id)
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/50"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {user.name || user.email}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dateien (nur bei bestehendem Eintrag) */}
              {editingEntry && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Dateien
                  </label>
                  {editingEntry.files.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {editingEntry.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-900 rounded-lg group"
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
                                {formatFileSize(file.fileSize)}
                              </span>
                            </div>
                          </a>
                          <button
                            onClick={() => handleFileDelete(editingEntry.id, file.id)}
                            className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
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
                  <FileUploadArea onUpload={(files) => handleFileUpload(editingEntry.id, files)} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                {editingEntry && (
                  <button
                    onClick={() => handleDelete(editingEntry.id)}
                    className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    Löschen
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formTitle.trim() || !formDueDate || saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Speichern..." : editingEntry ? "Aktualisieren" : "Erstellen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
