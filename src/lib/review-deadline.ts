const BERLIN_TZ = "Europe/Berlin";

/** Anzahl Werktage (Mo–Fr) bis zur Fertigstellung pro Workflow-Schritt. */
export const REVIEW_STEP_BUSINESS_DAYS = 2;

export function formatBerlinYmd(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: BERLIN_TZ });
}

function addCalendarDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

function weekdayBerlinYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const instant = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const w = instant.toLocaleDateString("en-US", {
    timeZone: BERLIN_TZ,
    weekday: "short",
  }) as keyof typeof WD;
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return WD[w] ?? 0;
}

function isWeekdayBerlinYmd(ymd: string): boolean {
  const wd = weekdayBerlinYmd(ymd);
  return wd >= 1 && wd <= 5;
}

/**
 * Fälligkeitsende für den neuen Review-Schritt: Ende des N-ten Werktags (Europe/Berlin),
 * gezählt ab dem nächsten Kalendertag nach dem Übergabezeitpunkt. Nur Mo–Fr, keine Feiertage.
 * Speicherung als UTC-Ende des Fälligkeitstages (Vergleich über Kalenderdatum).
 */
export function computeReviewStepDueAt(from: Date = new Date()): Date {
  let ymd = formatBerlinYmd(from);
  ymd = addCalendarDaysYmd(ymd, 1);
  let remaining = REVIEW_STEP_BUSINESS_DAYS;
  while (remaining > 0) {
    if (isWeekdayBerlinYmd(ymd)) {
      remaining--;
    }
    if (remaining > 0) {
      ymd = addCalendarDaysYmd(ymd, 1);
    }
  }
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

export function isReviewStepPastDue(dueAt: Date | null, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  const dueYmd = `${dueAt.getUTCFullYear()}-${String(dueAt.getUTCMonth() + 1).padStart(2, "0")}-${String(dueAt.getUTCDate()).padStart(2, "0")}`;
  const nowYmd = formatBerlinYmd(now);
  return nowYmd > dueYmd;
}

/** Anzeige des Fälligkeitsdatums (Kalendertag wie berechnet, unabhängig von Client-Zeitzone). */
export function formatReviewDueDateDe(dueAt: Date | string | null): string {
  if (!dueAt) return "";
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  return d.toLocaleDateString("de-DE", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
