"use client";

import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface EditorialEntry {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  category: string | null;
  ratgeberCategory: string | null;
  funnel: string | null;
  status: string;
  dueDate: string;
  journeyPhase: string | null;
  journeyConfidence: number | null;
  journeyReasoning: string | null;
  journeyMappedAt: string | null;
}

interface JourneyPhase {
  id: string;
  name: string;
  description: string;
  keywords: string;
}

interface MappedEntry extends EditorialEntry {
  journeyPhase: string;
  journeyConfidence: number;
  journeyReasoning: string;
}

const PHASE_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; funnelLabel: string; chartColor: string }> = {
  bewusstsein: {
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-300 dark:border-amber-700",
    funnelLabel: "Awareness",
    chartColor: "#f59e0b",
  },
  orientierung: {
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-300 dark:border-blue-700",
    funnelLabel: "Consideration",
    chartColor: "#3b82f6",
  },
  planung: {
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-300 dark:border-emerald-700",
    funnelLabel: "Intent",
    chartColor: "#10b981",
  },
  objektsuche: {
    color: "text-violet-700 dark:text-violet-300",
    bgColor: "bg-violet-50 dark:bg-violet-900/20",
    borderColor: "border-violet-300 dark:border-violet-700",
    funnelLabel: "Evaluation",
    chartColor: "#8b5cf6",
  },
  abschluss: {
    color: "text-rose-700 dark:text-rose-300",
    bgColor: "bg-rose-50 dark:bg-rose-900/20",
    borderColor: "border-rose-300 dark:border-rose-700",
    funnelLabel: "Decision",
    chartColor: "#f43f5e",
  },
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  planned: { label: "Geplant", className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300" },
  in_progress: { label: "In Arbeit", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  review: { label: "Review", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  published: { label: "Veröffentlicht", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

export default function CustomerJourneyPage() {
  const [entries, setEntries] = useState<EditorialEntry[]>([]);
  const [phases, setPhases] = useState<JourneyPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"funnel" | "list">("funnel");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/customer-journey");
      if (!res.ok) throw new Error("Fehler beim Laden der Daten");
      const data = await res.json();
      setEntries(data.entries);
      setPhases(data.phases);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  const unmappedEntries = entries.filter((e) => !e.journeyPhase);
  const mappedEntries = entries.filter((e): e is MappedEntry => e.journeyPhase !== null && e.journeyConfidence !== null && e.journeyReasoning !== null);
  const hasMappedEntries = mappedEntries.length > 0;

  const classifyEntries = useCallback(async (mode: "all" | "unmapped") => {
    try {
      setClassifying(true);
      setError(null);
      setSuccessMessage(null);
      const res = await fetch("/api/customer-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Klassifizierung fehlgeschlagen");
      }
      const data = await res.json();
      setEntries(data.entries);

      if (data.classified === 0) {
        setSuccessMessage("Alle Einträge sind bereits zugeordnet.");
      } else {
        setSuccessMessage(`${data.classified} von ${data.total} Einträgen erfolgreich zugeordnet und gespeichert.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Klassifizierung fehlgeschlagen");
    } finally {
      setClassifying(false);
    }
  }, []);

  const filteredEntries = mappedEntries.filter((entry) => {
    if (filterCategory !== "all" && entry.category !== filterCategory) return false;
    if (filterStatus !== "all" && entry.status !== filterStatus) return false;
    return true;
  });

  const groupedByPhase: Record<string, MappedEntry[]> = {};
  for (const phase of phases) {
    groupedByPhase[phase.id] = filteredEntries
      .filter((e) => e.journeyPhase === phase.id)
      .sort((a, b) => (b.journeyConfidence ?? 0) - (a.journeyConfidence ?? 0));
  }

  const categories = [...new Set(entries.map((e) => e.category).filter(Boolean))];
  const statuses = [...new Set(entries.map((e) => e.status).filter(Boolean))];

  const avgConfidence = mappedEntries.length > 0
    ? mappedEntries.reduce((sum, e) => sum + (e.journeyConfidence ?? 0), 0) / mappedEntries.length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Lade Redaktionsplan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Journey Mapping</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ordne Redaktionsplan-Inhalte den Phasen der Baufinanzierungs-Journey zu
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasMappedEntries && (
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setViewMode("funnel")}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === "funnel"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                Funnel
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === "list"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                Liste
              </button>
            </div>
          )}
          {unmappedEntries.length > 0 && hasMappedEntries && (
            <button
              onClick={() => classifyEntries("unmapped")}
              disabled={classifying}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {classifying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Zuordnung läuft...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {unmappedEntries.length} neue zuordnen
                </>
              )}
            </button>
          )}
          <button
            onClick={() => classifyEntries(hasMappedEntries ? "all" : "all")}
            disabled={classifying || entries.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {classifying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                KI analysiert...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                {hasMappedEntries ? "Alle neu zuordnen" : "KI-Zuordnung starten"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Success */}
      {successMessage && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
          <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
        </div>
      )}

      {/* Unmapped entries hint */}
      {unmappedEntries.length > 0 && hasMappedEntries && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {unmappedEntries.length} neue {unmappedEntries.length === 1 ? "Eintrag" : "Einträge"} ohne Zuordnung
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {unmappedEntries.slice(0, 3).map((e) => e.title).join(", ")}
              {unmappedEntries.length > 3 && ` und ${unmappedEntries.length - 3} weitere`}
            </p>
          </div>
          <button
            onClick={() => classifyEntries("unmapped")}
            disabled={classifying}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Jetzt zuordnen
          </button>
        </div>
      )}

      {/* Stats + Pie Chart */}
      {hasMappedEntries && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Artikel gesamt</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{entries.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Zugeordnet</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{mappedEntries.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Ø Konfidenz</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{(avgConfidence * 100).toFixed(0)}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">Abdeckung</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {phases.filter((p) => (groupedByPhase[p.id]?.length ?? 0) > 0).length}/{phases.length}
                </p>
                <span className="text-sm text-slate-500 dark:text-slate-400">Phasen</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Verteilung nach Phase</p>
            <div className="flex items-center gap-4">
              <div className="w-[140px] h-[140px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={phases.map((p) => ({
                        name: p.name,
                        value: groupedByPhase[p.id]?.length ?? 0,
                        phaseId: p.id,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {phases.map((p) => (
                        <Cell key={p.id} fill={PHASE_CONFIG[p.id]?.chartColor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} Artikel`, name]}
                      contentStyle={{
                        backgroundColor: "var(--color-slate-800, #1e293b)",
                        border: "none",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                {phases.map((p) => {
                  const count = groupedByPhase[p.id]?.length ?? 0;
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PHASE_CONFIG[p.id]?.chartColor }}
                      />
                      <span className="text-slate-600 dark:text-slate-400 truncate">{p.name}</span>
                      <span className="font-semibold text-slate-900 dark:text-white ml-auto">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {hasMappedEntries && (
        <div className="flex flex-wrap gap-3">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <option value="all">Alle Kategorien</option>
            {categories.map((cat) => (
              <option key={cat} value={cat!}>{cat}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <option value="all">Alle Status</option>
            {statuses.map((s) => (
              <option key={s} value={s!}>{STATUS_LABELS[s!]?.label || s}</option>
            ))}
          </select>
        </div>
      )}

      {/* No mappings yet */}
      {!hasMappedEntries && !classifying && (
        <div className="rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 p-12 text-center">
          <svg className="mx-auto h-16 w-16 text-slate-400 dark:text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">KI-Zuordnung starten</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Klicke auf &quot;KI-Zuordnung starten&quot;, um {entries.length} Artikel aus dem Redaktionsplan automatisch den 5 Phasen der Customer Journey zuzuordnen.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            {phases.map((phase, i) => (
              <span key={phase.id} className="flex items-center gap-1">
                <span>{phase.name}</span>
                {i < phases.length - 1 && <span className="mx-1">→</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Funnel View */}
      {hasMappedEntries && viewMode === "funnel" && (
        <div className="space-y-4">
          {phases.map((phase, index) => {
            const config = PHASE_CONFIG[phase.id];
            const phaseEntries = groupedByPhase[phase.id] || [];
            return (
              <div key={phase.id} className={`rounded-lg border-2 ${config.borderColor} ${config.bgColor} overflow-hidden`}>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className={`text-lg font-bold ${config.color}`}>
                          Phase {index + 1}: {phase.name}
                        </h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bgColor} ${config.color} border ${config.borderColor}`}>
                          {config.funnelLabel}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{phase.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${config.color}`}>{phaseEntries.length}</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Artikel</span>
                  </div>
                </div>
                {phaseEntries.length > 0 && (
                  <div className="px-6 pb-4">
                    <div className="grid gap-3">
                      {phaseEntries.map((entry) => (
                        <EntryCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                )}
                {phaseEntries.length === 0 && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">Keine Artikel in dieser Phase zugeordnet</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {hasMappedEntries && viewMode === "list" && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Artikel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kategorie</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Journey Phase</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Konfidenz</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Begründung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredEntries
                  .sort((a, b) => {
                    const phaseOrder = phases.map((p) => p.id);
                    return phaseOrder.indexOf(a.journeyPhase) - phaseOrder.indexOf(b.journeyPhase);
                  })
                  .map((entry) => {
                    const config = PHASE_CONFIG[entry.journeyPhase];
                    const status = STATUS_LABELS[entry.status];
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm text-slate-900 dark:text-white">{entry.title}</div>
                          {entry.url && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[300px]">{entry.url}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{entry.category || "–"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${config?.color}`}>
                            {phases.find((p) => p.id === entry.journeyPhase)?.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ConfidenceBadge confidence={entry.journeyConfidence} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status?.className || "bg-slate-100 text-slate-700"}`}>
                            {status?.label || entry.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[250px]">{entry.journeyReasoning}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EntryCard({ entry }: { entry: MappedEntry }) {
  const status = STATUS_LABELS[entry.status];
  return (
    <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{entry.title}</h3>
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status?.className || "bg-slate-100 text-slate-700"}`}>
            {status?.label || entry.status}
          </span>
        </div>
        {entry.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-1">{entry.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          {entry.category && <span>{entry.category}</span>}
          {entry.ratgeberCategory && (
            <>
              <span>·</span>
              <span>{entry.ratgeberCategory}</span>
            </>
          )}
          {entry.url && (
            <>
              <span>·</span>
              <span className="truncate max-w-[200px]">{entry.url}</span>
            </>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">{entry.journeyReasoning}</p>
      </div>
      <ConfidenceBadge confidence={entry.journeyConfidence} />
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  let colorClass = "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20";
  if (percent >= 80) colorClass = "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20";
  else if (percent >= 60) colorClass = "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20";

  return (
    <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${colorClass}`}>
      {percent}%
    </span>
  );
}
