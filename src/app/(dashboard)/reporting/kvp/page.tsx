"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart, PieChart } from "@/components/charts";

const KEYWORD_CATEGORIES = [
  "Mortgages",
  "Accounts&Cards",
  "Investing",
  "Pension",
  "Digital Banking",
] as const;

// Zeitraum-Presets
type PresetKey = "current_month" | "last_month" | "last_quarter" | "last_half" | "ytd" | "last_year" | "all" | "custom";

interface Preset {
  key: PresetKey;
  label: string;
  getRange: () => { from: string; to: string };
}

const getPresets = (): Preset[] => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return [
    {
      key: "current_month",
      label: "Aktueller Monat",
      getRange: () => {
        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 0);
        return { from: toDateStr(from), to: toDateStr(to) };
      },
    },
    {
      key: "last_month",
      label: "Letzter Monat",
      getRange: () => {
        const from = new Date(year, month - 1, 1);
        const to = new Date(year, month, 0);
        return { from: toDateStr(from), to: toDateStr(to) };
      },
    },
    {
      key: "last_quarter",
      label: "Letztes Quartal (3 Monate)",
      getRange: () => {
        const from = new Date(year, month - 2, 1);
        const to = new Date(year, month + 1, 0);
        return { from: toDateStr(from), to: toDateStr(to) };
      },
    },
    {
      key: "last_half",
      label: "Letztes Halbjahr (6 Monate)",
      getRange: () => {
        const from = new Date(year, month - 5, 1);
        const to = new Date(year, month + 1, 0);
        return { from: toDateStr(from), to: toDateStr(to) };
      },
    },
    {
      key: "ytd",
      label: "Laufendes Jahr (YTD)",
      getRange: () => {
        const from = new Date(year, 0, 1);
        const to = new Date(year, month + 1, 0);
        return { from: toDateStr(from), to: toDateStr(to) };
      },
    },
    {
      key: "last_year",
      label: "Letztes Jahr (12 Monate)",
      getRange: () => {
        const from = new Date(year - 1, month + 1, 1);
        const to = new Date(year, month + 1, 0);
        return { from: toDateStr(from), to: toDateStr(to) };
      },
    },
    {
      key: "all",
      label: "Gesamter Zeitraum",
      getRange: () => {
        return { from: "2020-01-01", to: toDateStr(new Date(year, month + 1, 0)) };
      },
    },
    {
      key: "custom",
      label: "Benutzerdefiniert",
      getRange: () => {
        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 0);
        return { from: toDateStr(from), to: toDateStr(to) };
      },
    },
  ];
};

// Hilfsfunktion: Date -> YYYY-MM-DD String
const toDateStr = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

interface SimpleUser {
  id: string;
  name: string | null;
  email: string;
}

interface KVPSubkeyword {
  id: string;
  keyword: string;
  createdAt: string;
}

interface MaturityLink {
  id: string;
  kvpUrlId: string;
  maturityItemId: string;
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

interface KVPAssignee {
  id: string;
  userId: string;
  user: SimpleUser;
}

interface KVPUrlData {
  id: string;
  url: string;
  focusKeyword: string;
  category: string | null;
  subkeywords: KVPSubkeyword[];
  maturityLinks: MaturityLink[];
  assignees: KVPAssignee[];
  createdAt: string;
  updatedAt: string;
}

interface CategoryStat {
  category: string;
  count: number;
}

interface MaturityCategoryStat {
  category: string;
  linkCount: number;
  uniqueItems: number;
  items: string[];
}

interface MonthStat {
  month: string;
  count: number;
}

interface ReportStats {
  totalKvps: number;
  totalSubkeywords: number;
  totalFocusKeywords: number;
  totalMaturityLinks: number;
  uniqueMaturityItems: number;
}

interface KVPReportData {
  kvpUrls: KVPUrlData[];
  stats: ReportStats;
  categoryStats: CategoryStat[];
  maturityCategoryStats: MaturityCategoryStat[];
  monthlyStats: MonthStat[];
  availableMonths: string[];
  dateRange: { earliest: string; latest: string } | null;
  period: {
    start: string;
    end: string;
  };
}

// Formatiere Datum
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Formatiere Zeitraum als lesbare Beschreibung
const formatPeriodLabel = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Gleicher Monat?
  if (
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth()
  ) {
    return startDate.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
    });
  }

  // Gleicher Monat und Jahr? (Start 1. und End letzter Tag)
  const startMonth = startDate.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
  const endMonth = endDate.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
  return `${startMonth} - ${endMonth}`;
};

export default function KVPReportPage() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<KVPReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");

  // Datumsrange State
  const presets = useMemo(() => getPresets(), []);
  const [activePreset, setActivePreset] = useState<PresetKey>("current_month");
  const defaultRange = presets[0].getRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Daten laden wenn sich Filter ändern
  useEffect(() => {
    if (mounted) {
      fetchData();
    }
  }, [dateFrom, dateTo, categoryFilter, mounted]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("from", dateFrom);
      params.set("to", dateTo);
      if (categoryFilter) params.set("category", categoryFilter);

      const res = await fetch(`/api/reporting/kvp-report?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden der Daten");
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching KVP report:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Preset anwenden
  const applyPreset = useCallback(
    (key: PresetKey) => {
      setActivePreset(key);
      if (key === "custom") {
        setShowCustom(true);
        return;
      }
      setShowCustom(false);
      const preset = presets.find((p) => p.key === key);
      if (preset) {
        const range = preset.getRange();
        setDateFrom(range.from);
        setDateTo(range.to);
      }
    },
    [presets]
  );

  // Pie-Chart Daten: Kategorieverteilung
  const categoryPieData = useMemo(() => {
    if (!data) return [];
    return data.categoryStats
      .filter((c) => c.count > 0)
      .map((c) => ({
        name: c.category,
        value: c.count,
      }));
  }, [data]);

  // Bar-Chart Daten: Maturity-Kategorien
  const maturityBarData = useMemo(() => {
    if (!data) return [];
    return data.maturityCategoryStats
      .sort((a, b) => b.linkCount - a.linkCount)
      .map((m) => ({
        category: m.category.length > 20 ? m.category.substring(0, 20) + "..." : m.category,
        fullCategory: m.category,
        "Verknüpfungen": m.linkCount,
        "Reifegrad-Punkte": m.uniqueItems,
      }));
  }, [data]);

  // Bar-Chart Daten: Monatliche Entwicklung
  const monthlyBarData = useMemo(() => {
    if (!data) return [];
    return data.monthlyStats
      .slice(0, 12)
      .reverse()
      .map((m) => {
        const [y, mo] = m.month.split("-").map(Number);
        const d = new Date(y, mo - 1, 1);
        return {
          month: d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
          "Neue KVPs": m.count,
        };
      });
  }, [data]);

  // Gruppierte KVPs nach Kategorie
  const kvpsByCategory = useMemo(() => {
    if (!data) return {};
    return data.kvpUrls.reduce((acc, url) => {
      const cat = url.category || "Keine Kategorie";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(url);
      return acc;
    }, {} as Record<string, KVPUrlData[]>);
  }, [data]);

  // Zeitraum-Label
  const periodLabel = useMemo(() => {
    if (!data) return "";
    return formatPeriodLabel(data.period.start, data.period.end);
  }, [data]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <Link
            href="/reporting"
            className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurück zu Reporting
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">KVP Report</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Übersicht der SEO-Massnahmen im Kontinuierlichen Verbesserungsprozess
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Kategorien</option>
            {KEYWORD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Zeitraum-Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col gap-3">
          {/* Preset-Buttons */}
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.key}
                onClick={() => applyPreset(preset.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  activePreset === preset.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Benutzerdefinierte Datumseingabe */}
          {showCustom && (
            <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Von
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Bis
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 pb-2">
                {formatDate(dateFrom)} - {formatDate(dateTo)}
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : !data ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-500 dark:text-slate-400">
            Fehler beim Laden der Daten.
          </p>
        </div>
      ) : (
        <>
          {/* Zeitraum-Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{periodLabel}</h2>
                <p className="text-blue-200 text-sm mt-1">
                  Zeitraum: {formatDate(data.period.start)} - {formatDate(data.period.end)}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{data.stats.totalKvps}</div>
                <div className="text-blue-200 text-sm">
                  {data.stats.totalKvps === 1 ? "KVP" : "KVPs"}
                </div>
              </div>
            </div>
          </div>

          {/* Übersicht Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard title="KVPs" value={data.stats.totalKvps} />
            <StatCard
              title="Fokus-Keywords"
              value={data.stats.totalFocusKeywords}
              subtitle="Einzigartige"
            />
            <StatCard
              title="Sub-Keywords"
              value={data.stats.totalSubkeywords}
              subtitle="Hinzugefügt"
            />
            <StatCard
              title="Reifegrad-Verknüpfungen"
              value={data.stats.totalMaturityLinks}
            />
            <StatCard
              title="Reifegrad-Punkte"
              value={data.stats.uniqueMaturityItems}
              subtitle="Adressiert"
            />
          </div>

          {data.stats.totalKvps === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Keine KVPs im gewählten Zeitraum
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Im Zeitraum {formatDate(data.period.start)} - {formatDate(data.period.end)} wurden keine neuen KVPs erstellt.
                Wähle einen anderen Zeitraum aus oder erstelle einen neuen KVP.
              </p>
              <Link
                href="/kvp"
                className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Zum KVP
              </Link>
            </div>
          ) : (
            <>
              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Kategorieverteilung */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    KVPs nach Kategorie
                  </h3>
                  {categoryPieData.length > 0 ? (
                    <PieChart data={categoryPieData} height={280} />
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-slate-500">
                      Keine Daten
                    </div>
                  )}
                </div>

                {/* Reifegrad-Kategorien */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Adressierte Reifegrad-Kategorien
                  </h3>
                  {maturityBarData.length > 0 ? (
                    <BarChart
                      data={maturityBarData}
                      xKey="category"
                      yKey="Verknüpfungen"
                      height={280}
                      color="#6366f1"
                    />
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                      Keine Reifegrad-Verknüpfungen im gewählten Zeitraum
                    </div>
                  )}
                </div>
              </div>

              {/* Monatliche Entwicklung */}
              {monthlyBarData.length > 1 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    KVP-Entwicklung über die Monate
                  </h3>
                  <BarChart
                    data={monthlyBarData}
                    xKey="month"
                    yKey="Neue KVPs"
                    height={250}
                    color="#3b82f6"
                  />
                </div>
              )}

              {/* Reifegrad-Detail Übersicht */}
              {data.maturityCategoryStats.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Adressierte SEO-Reifegradpunkte
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Welche Reifegrad-Bereiche wurden durch die KVP-Massnahmen im Zeitraum {periodLabel} adressiert
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.maturityCategoryStats
                      .sort((a, b) => b.linkCount - a.linkCount)
                      .map((stat) => (
                        <div
                          key={stat.category}
                          className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                              {stat.category}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                {stat.uniqueItems} {stat.uniqueItems === 1 ? "Punkt" : "Punkte"}
                              </span>
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                {stat.linkCount} {stat.linkCount === 1 ? "Verknüpfung" : "Verknüpfungen"}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            {stat.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                              >
                                <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Detail-Tabelle: Alle KVPs im Zeitraum */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    KVP-Massnahmen im Detail ({data.stats.totalKvps})
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Alle im Zeitraum {periodLabel} erstellten KVPs mit Fokus-Keywords, Sub-Keywords und Reifegrad-Verknüpfungen
                  </p>
                </div>

                {/* Nach Kategorie gruppiert */}
                {Object.entries(kvpsByCategory)
                  .sort(([a], [b]) => a.localeCompare(b, "de"))
                  .map(([category, urls]) => (
                    <div key={category}>
                      {/* Kategorie-Header */}
                      <div className="px-6 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                            {category}
                          </h4>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {urls.length} {urls.length === 1 ? "KVP" : "KVPs"}
                          </span>
                        </div>
                      </div>

                      {/* KVP Einträge */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {urls.map((url) => (
                          <div key={url.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                    {url.focusKeyword}
                                  </span>
                                  <span className="text-xs text-slate-500 dark:text-slate-500">
                                    {formatDate(url.createdAt)}
                                  </span>
                                </div>
                                <a
                                  href={url.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 break-all transition-colors"
                                >
                                  {url.url}
                                </a>
                              </div>
                              {url.assignees && url.assignees.length > 0 && (
                                <div className="flex flex-wrap gap-1 shrink-0">
                                  {url.assignees.map((assignee) => (
                                    <span
                                      key={assignee.id}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                    >
                                      {assignee.user.name || assignee.user.email}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Sub-Keywords */}
                            {url.subkeywords.length > 0 && (
                              <div className="mb-3">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                  Sub-Keywords:
                                </span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {url.subkeywords.map((sub) => (
                                    <span
                                      key={sub.id}
                                      className="inline-flex px-2 py-0.5 text-xs rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                                    >
                                      {sub.keyword}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Maturity Links */}
                            {url.maturityLinks.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                  Reifegrad-Verknüpfungen:
                                </span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {url.maturityLinks.map((link) => (
                                    <span
                                      key={link.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                      title={`${link.maturityItem.category} - Score: ${link.maturityItem.score}/10`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                          link.maturityItem.score <= 3
                                            ? "bg-red-500"
                                            : link.maturityItem.score <= 5
                                            ? "bg-orange-500"
                                            : link.maturityItem.score <= 7
                                            ? "bg-blue-500"
                                            : "bg-green-500"
                                        }`}
                                      />
                                      {link.maturityItem.title}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Wenn weder Sub-Keywords noch Maturity Links */}
                            {url.subkeywords.length === 0 && url.maturityLinks.length === 0 && (
                              <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                                Keine Sub-Keywords oder Reifegrad-Verknüpfungen
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Zusammenfassung am Ende */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Zusammenfassung: {periodLabel}
                </h3>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
                    <p>
                      Im Berichtszeitraum{" "}
                      <strong className="text-slate-900 dark:text-white">
                        {formatDate(data.period.start)} - {formatDate(data.period.end)}
                      </strong>{" "}
                      wurden insgesamt{" "}
                      <strong className="text-blue-600 dark:text-blue-400">
                        {data.stats.totalKvps} {data.stats.totalKvps === 1 ? "KVP" : "KVPs"}
                      </strong>{" "}
                      erstellt
                      {data.stats.totalSubkeywords > 0 && (
                        <>
                          , mit{" "}
                          <strong className="text-slate-900 dark:text-white">
                            {data.stats.totalFocusKeywords} Fokus-Keywords
                          </strong>{" "}
                          und{" "}
                          <strong className="text-slate-900 dark:text-white">
                            {data.stats.totalSubkeywords} Sub-Keywords
                          </strong>
                        </>
                      )}
                      .
                    </p>
                    {data.categoryStats.length > 0 && (
                      <p>
                        Die Massnahmen verteilten sich auf folgende Kategorien:{" "}
                        {data.categoryStats
                          .sort((a, b) => b.count - a.count)
                          .map((c, i) => (
                            <span key={c.category}>
                              {i > 0 && i < data.categoryStats.length - 1 && ", "}
                              {i > 0 && i === data.categoryStats.length - 1 && " und "}
                              <strong className="text-slate-900 dark:text-white">
                                {c.category}
                              </strong>{" "}
                              ({c.count})
                            </span>
                          ))}
                        .
                      </p>
                    )}
                    {data.maturityCategoryStats.length > 0 && (
                      <p>
                        Durch die KVP-Massnahmen wurden{" "}
                        <strong className="text-indigo-600 dark:text-indigo-400">
                          {data.stats.uniqueMaturityItems} Reifegrad-Punkte
                        </strong>{" "}
                        in {data.maturityCategoryStats.length}{" "}
                        {data.maturityCategoryStats.length === 1 ? "Kategorie" : "Kategorien"}{" "}
                        adressiert ({data.maturityCategoryStats.map((m) => m.category).join(", ")}).
                      </p>
                    )}
                    {data.maturityCategoryStats.length === 0 && data.stats.totalKvps > 0 && (
                      <p className="text-amber-600 dark:text-amber-400">
                        Hinweis: Es wurden noch keine Reifegrad-Verknüpfungen für die KVPs in diesem
                        Zeitraum erstellt. Diese können im{" "}
                        <Link href="/kvp" className="underline hover:no-underline">
                          KVP-Bereich
                        </Link>{" "}
                        hinzugefügt werden.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
