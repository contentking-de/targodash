"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";

interface AbsenceUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Absence {
  id: string;
  userId: string;
  user: AbsenceUser;
  type: string;
  startDate: string;
  endDate: string;
  note: string | null;
  createdAt: string;
}

const ABSENCE_TYPES = [
  { value: "urlaub", label: "Urlaub", color: "bg-blue-500", lightColor: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300", icon: "🏖️" },
  { value: "krank", label: "Krank", color: "bg-red-500", lightColor: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300", icon: "🤒" },
  { value: "homeoffice", label: "Homeoffice", color: "bg-emerald-500", lightColor: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", icon: "🏠" },
  { value: "fortbildung", label: "Fortbildung", color: "bg-purple-500", lightColor: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300", icon: "📚" },
  { value: "sonstiges", label: "Sonstiges", color: "bg-slate-500", lightColor: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300", icon: "📋" },
];

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getAbsenceTypeConfig(type: string) {
  return ABSENCE_TYPES.find((t) => t.value === type) || ABSENCE_TYPES[4];
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isDateInRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start.slice(0, 10) && dateStr <= end.slice(0, 10);
}

function getWorkingDays(start: string, end: string): number {
  let count = 0;
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export default function AbwesenheitenPage() {
  const today = new Date();
  const { data: session } = useSession();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"calendar" | "team">("team");

  const [formType, setFormType] = useState("urlaub");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  const hasAdminRights = session?.user?.role === "superadmin" || session?.user?.role === "agentur";

  const fetchAbsences = useCallback(async () => {
    try {
      const res = await fetch(`/api/absences?year=${currentYear}&month=${currentMonth}`);
      const data = await res.json();
      if (data.absences) setAbsences(data.absences);
    } catch (error) {
      console.error("Error fetching absences:", error);
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    setLoading(true);
    fetchAbsences();
  }, [fetchAbsences]);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, AbsenceUser>();
    absences.forEach((a) => map.set(a.user.id, a.user));
    return Array.from(map.values()).sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email)
    );
  }, [absences]);

  const filteredAbsences = useMemo(() => {
    return absences.filter((a) => {
      if (filterType !== "all" && a.type !== filterType) return false;
      if (filterUser !== "all" && a.userId !== filterUser) return false;
      return true;
    });
  }, [absences, filterType, filterUser]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  }

  function goToToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  }

  function openCreateModal(dateStr?: string) {
    setEditingAbsence(null);
    setFormType("urlaub");
    setFormStartDate(dateStr || toDateStr(today));
    setFormEndDate(dateStr || toDateStr(today));
    setFormNote("");
    setShowModal(true);
  }

  function openEditModal(absence: Absence) {
    if (absence.userId !== session?.user?.id && !hasAdminRights) return;
    setEditingAbsence(absence);
    setFormType(absence.type);
    setFormStartDate(absence.startDate.slice(0, 10));
    setFormEndDate(absence.endDate.slice(0, 10));
    setFormNote(absence.note || "");
    setShowModal(true);
  }

  async function handleSave() {
    if (!formStartDate || !formEndDate) return;
    setSaving(true);

    try {
      const payload = {
        type: formType,
        startDate: formStartDate,
        endDate: formEndDate,
        note: formNote.trim() || null,
      };

      if (editingAbsence) {
        const res = await fetch(`/api/absences/${editingAbsence.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setAbsences((prev) => prev.map((a) => (a.id === data.absence.id ? data.absence : a)));
        }
      } else {
        const res = await fetch("/api/absences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          setAbsences((prev) => [...prev, data.absence]);
        }
      }

      setShowModal(false);
    } catch (error) {
      console.error("Error saving absence:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Abwesenheit wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/absences/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAbsences((prev) => prev.filter((a) => a.id !== id));
        setShowModal(false);
      }
    } catch (error) {
      console.error("Error deleting absence:", error);
    }
  }

  const calendarCells: { day: number | null; dateStr: string | null }[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(currentMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    calendarCells.push({ day: d, dateStr: `${currentYear}-${m}-${dd}` });
  }

  const todayStr = toDateStr(today);

  const absencesByDate = useMemo(() => {
    const map: Record<string, Absence[]> = {};
    filteredAbsences.forEach((absence) => {
      const start = absence.startDate.slice(0, 10);
      const end = absence.endDate.slice(0, 10);
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (isDateInRange(dateStr, start, end)) {
          if (!map[dateStr]) map[dateStr] = [];
          if (!map[dateStr].find((a) => a.id === absence.id)) {
            map[dateStr].push(absence);
          }
        }
      }
    });
    return map;
  }, [filteredAbsences, daysInMonth, currentYear, currentMonth]);

  const allTeamUsers = useMemo(() => {
    const map = new Map<string, AbsenceUser>();
    absences.forEach((a) => map.set(a.user.id, a.user));
    return Array.from(map.values()).sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email)
    );
  }, [absences]);

  const stats = useMemo(() => {
    const todayAbsent = filteredAbsences.filter((a) =>
      isDateInRange(todayStr, a.startDate, a.endDate)
    );
    const thisMonth = filteredAbsences.length;
    const urlaubCount = absences.filter((a) => a.type === "urlaub" && isDateInRange(todayStr, a.startDate, a.endDate)).length;
    const krankCount = absences.filter((a) => a.type === "krank" && isDateInRange(todayStr, a.startDate, a.endDate)).length;
    return { todayAbsent: todayAbsent.length, thisMonth, urlaubCount, krankCount };
  }, [filteredAbsences, absences, todayStr]);

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Abwesenheitskalender</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Urlaubs- und Abwesenheitsplanung für das gesamte Team
          </p>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Abwesenheit eintragen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Heute abwesend</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.todayAbsent}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Einträge diesen Monat</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.thisMonth}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wider">Heute im Urlaub</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.urlaubCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-xs font-medium text-red-500 dark:text-red-400 uppercase tracking-wider">Heute krank</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.krankCount}</p>
        </div>
      </div>

      {/* Filters + View Toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
        >
          <option value="all">Alle Typen</option>
          {ABSENCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>
        {uniqueUsers.length > 0 && (
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle Personen</option>
            {uniqueUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
        )}
        <div className="ml-auto flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode("team")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "team"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Team-Übersicht
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === "calendar"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Kalender
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-400">Legende:</span>
        {ABSENCE_TYPES.map((t) => (
          <span key={t.value} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${t.color}`} />
            <span className="text-slate-600 dark:text-slate-400">{t.label}</span>
          </span>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white min-w-[180px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
          Heute
        </button>
      </div>

      {/* Team Timeline View */}
      {viewMode === "team" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="sticky left-0 z-10 bg-white dark:bg-slate-800 px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-48 min-w-[192px]">
                    Person
                  </th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1;
                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const date = new Date(currentYear, currentMonth, d);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isToday = dateStr === todayStr;
                    return (
                      <th
                        key={d}
                        className={`px-0 py-2 text-center text-xs font-medium min-w-[32px] ${
                          isToday
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                            : isWeekend
                              ? "bg-slate-50 dark:bg-slate-900/30 text-slate-400 dark:text-slate-500"
                              : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <div className="text-[10px]">{DAY_NAMES[(date.getDay() + 6) % 7]}</div>
                        <div className={`text-sm ${isToday ? "font-bold" : ""}`}>{d}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allTeamUsers.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Noch keine Abwesenheiten eingetragen.
                    </td>
                  </tr>
                ) : (
                  allTeamUsers.map((user) => {
                    const userAbsences = filteredAbsences.filter((a) => a.userId === user.id);
                    return (
                      <tr key={user.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium text-white">
                                {(user.name || user.email)[0].toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {user.name || user.email}
                            </span>
                          </div>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const d = i + 1;
                          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                          const date = new Date(currentYear, currentMonth, d);
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          const isToday = dateStr === todayStr;
                          const dayAbsence = userAbsences.find((a) =>
                            isDateInRange(dateStr, a.startDate, a.endDate)
                          );

                          if (dayAbsence) {
                            const typeConfig = getAbsenceTypeConfig(dayAbsence.type);
                            const startStr = dayAbsence.startDate.slice(0, 10);
                            const endStr = dayAbsence.endDate.slice(0, 10);
                            const isStart = dateStr === startStr;
                            const isEnd = dateStr === endStr;
                            return (
                              <td
                                key={d}
                                className={`px-0 py-2 cursor-pointer ${isToday ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                                onClick={() => openEditModal(dayAbsence)}
                                title={`${typeConfig.label}${dayAbsence.note ? `: ${dayAbsence.note}` : ""} (${new Date(startStr).toLocaleDateString("de-DE")} – ${new Date(endStr).toLocaleDateString("de-DE")})`}
                              >
                                <div
                                  className={`h-7 ${typeConfig.color} opacity-90 hover:opacity-100 transition-opacity ${
                                    isStart && isEnd ? "mx-1 rounded" :
                                    isStart ? "ml-1 rounded-l" :
                                    isEnd ? "mr-1 rounded-r" : ""
                                  }`}
                                />
                              </td>
                            );
                          }

                          return (
                            <td
                              key={d}
                              className={`px-0 py-2 ${
                                isToday
                                  ? "bg-blue-50/50 dark:bg-blue-900/10"
                                  : isWeekend
                                    ? "bg-slate-50/50 dark:bg-slate-900/20"
                                    : ""
                              }`}
                              onDoubleClick={() => {
                                if (user.id === session?.user?.id) openCreateModal(dateStr);
                              }}
                            >
                              <div className="h-7" />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, idx) => {
              const dayAbsences = cell.dateStr ? (absencesByDate[cell.dateStr] || []) : [];
              const isToday = cell.dateStr === todayStr;
              const date = cell.dateStr ? new Date(cell.dateStr) : null;
              const isWeekend = date ? (date.getDay() === 0 || date.getDay() === 6) : false;

              return (
                <div
                  key={idx}
                  className={`min-h-[110px] border-b border-r border-slate-100 dark:border-slate-700/50 p-1.5 transition-colors ${
                    cell.day === null
                      ? "bg-slate-50/50 dark:bg-slate-900/30"
                      : isWeekend
                        ? "bg-slate-50/30 dark:bg-slate-900/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                  onDoubleClick={() => {
                    if (cell.dateStr) openCreateModal(cell.dateStr);
                  }}
                >
                  {cell.day !== null && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                          isToday ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-300"
                        }`}>
                          {cell.day}
                        </span>
                        {dayAbsences.length > 0 && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {dayAbsences.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {dayAbsences.slice(0, 3).map((absence) => {
                          const typeConfig = getAbsenceTypeConfig(absence.type);
                          return (
                            <button
                              key={absence.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(absence);
                              }}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] leading-tight truncate ${typeConfig.lightColor} hover:opacity-80 transition-opacity`}
                              title={`${absence.user.name || absence.user.email}: ${typeConfig.label}${absence.note ? ` – ${absence.note}` : ""}`}
                            >
                              <span className="mr-0.5">{typeConfig.icon}</span>
                              {absence.user.name || absence.user.email.split("@")[0]}
                            </button>
                          );
                        })}
                        {dayAbsences.length > 3 && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1.5">
                            +{dayAbsences.length - 3} weitere
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
      )}

      {/* Upcoming / Current Absences List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Aktuelle & kommende Abwesenheiten</h3>
        {filteredAbsences.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Keine Abwesenheiten in diesem Monat.</p>
        ) : (
          <div className="space-y-2">
            {filteredAbsences
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((absence) => {
                const typeConfig = getAbsenceTypeConfig(absence.type);
                const isOwn = absence.userId === session?.user?.id;
                const isActive = isDateInRange(todayStr, absence.startDate, absence.endDate);
                const workingDays = getWorkingDays(absence.startDate.slice(0, 10), absence.endDate.slice(0, 10));
                return (
                  <div
                    key={absence.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border-l-4 ${
                      isActive ? "border-l-green-500 bg-green-50/50 dark:bg-green-900/10" : "border-l-slate-300 dark:border-l-slate-600 bg-slate-50 dark:bg-slate-900/50"
                    } ${isOwn || hasAdminRights ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/70" : ""} transition-colors`}
                    onClick={() => {
                      if (isOwn || hasAdminRights) openEditModal(absence);
                    }}
                  >
                    <div className={`w-10 h-10 rounded-lg ${typeConfig.color} flex items-center justify-center text-lg flex-shrink-0`}>
                      {typeConfig.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900 dark:text-white">
                          {absence.user.name || absence.user.email}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            Aktuell
                          </span>
                        )}
                        {isOwn && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            Mein Eintrag
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.lightColor}`}>
                          {typeConfig.label}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(absence.startDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                          {absence.startDate.slice(0, 10) !== absence.endDate.slice(0, 10) && (
                            <> – {new Date(absence.endDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</>
                          )}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          ({workingDays} {workingDays === 1 ? "Arbeitstag" : "Arbeitstage"})
                        </span>
                      </div>
                      {absence.note && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{absence.note}</p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingAbsence ? "Abwesenheit bearbeiten" : "Abwesenheit eintragen"}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Art der Abwesenheit</label>
                <div className="flex flex-wrap gap-2">
                  {ABSENCE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setFormType(t.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                        formType === t.value
                          ? `${t.lightColor} ring-2 ring-offset-1 ring-blue-500`
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      <span>{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Von *</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value);
                      if (e.target.value > formEndDate) setFormEndDate(e.target.value);
                    }}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bis *</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    min={formStartDate}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {formStartDate && formEndDate && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {getWorkingDays(formStartDate, formEndDate)} Arbeitstage
                </p>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notiz (optional)</label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  rows={2}
                  placeholder="z.B. Vertretung: Max Mustermann"
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                {editingAbsence && (editingAbsence.userId === session?.user?.id || hasAdminRights) && (
                  <button
                    onClick={() => handleDelete(editingAbsence.id)}
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
                  disabled={!formStartDate || !formEndDate || saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Speichern..." : editingAbsence ? "Aktualisieren" : "Eintragen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
