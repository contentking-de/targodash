import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import path from "path";

const prisma = new PrismaClient();

function extractTextFromCell(cellValue: unknown): string | null {
  if (!cellValue) return null;

  if (typeof cellValue === "string") {
    return cellValue.trim();
  }

  if (typeof cellValue === "object" && "richText" in (cellValue as object)) {
    const rt = cellValue as { richText: Array<{ text: string }> };
    return rt.richText.map((part) => part.text).join("").trim();
  }

  return String(cellValue).trim();
}

function cleanTitle(raw: string): string {
  let cleaned = raw.replace(/^\d+\.\s*/, "").trim();
  cleaned = cleaned.replace(/[„""]/g, "").trim();
  return cleaned;
}

function getWeekdays(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  current.setHours(9, 0, 0, 0);

  while (current <= endDate) {
    const dow = current.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

const skipTitles = new Set(["käufer", "inhaber", "inbaber"]);

async function importRedaktionsplan() {
  console.log("📖 Lese Excel-Datei...");

  const filePath = path.join(process.cwd(), "public", "redaktionsplan-final.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    console.error("❌ Kein Worksheet gefunden");
    process.exit(1);
  }

  interface TopicEntry {
    title: string;
    ratgeberCategory: string;
    funnel: string;
  }

  const topics: TopicEntry[] = [];
  let currentCategory = "";
  let currentFunnel = "";

  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;

    const col1 = extractTextFromCell(row.getCell(1).value);
    const col2 = extractTextFromCell(row.getCell(2).value);
    const col3 = extractTextFromCell(row.getCell(3).value);

    if (col1) currentCategory = col1.trim();
    if (col2) currentFunnel = col2.trim();

    if (!col3) return;

    const cleaned = cleanTitle(col3);
    if (!cleaned || skipTitles.has(cleaned.toLowerCase())) return;

    topics.push({
      title: cleaned,
      ratgeberCategory: currentCategory,
      funnel: currentFunnel,
    });
  });

  console.log(`📋 ${topics.length} Themen aus Excel extrahiert\n`);

  // Zeitraum: Montag nach heute bis 15. Juni 2026 (nur Wochentage)
  const startDate = new Date("2026-03-09");
  const endDate = new Date("2026-06-15");
  const weekdays = getWeekdays(startDate, endDate);

  console.log(`📅 Verfügbare Wochentage: ${weekdays.length} (${startDate.toLocaleDateString("de-DE")} – ${endDate.toLocaleDateString("de-DE")})`);

  // Gleichmäßig verteilen
  const interval = weekdays.length / topics.length;

  const assignments = topics.map((topic, i) => {
    const dayIndex = Math.min(Math.floor(i * interval), weekdays.length - 1);
    return { ...topic, dueDate: weekdays[dayIndex] };
  });

  // Ersten superadmin als Creator verwenden
  const creator = await prisma.user.findFirst({
    where: { role: "superadmin" },
    orderBy: { createdAt: "asc" },
  });

  if (!creator) {
    console.error("❌ Kein Superadmin-User gefunden");
    process.exit(1);
  }

  console.log(`👤 Creator: ${creator.name} (${creator.email})\n`);

  // Vorschau
  console.log("📝 Vorschau der Zuweisungen:\n");
  console.log("Datum            | Ratgeber-Kategorie                     | Funnel        | Titel");
  console.log("-".repeat(140));
  for (const a of assignments) {
    const dateStr = a.dueDate.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    console.log(
      `${dateStr.padEnd(17)}| ${a.ratgeberCategory.padEnd(39)}| ${a.funnel.padEnd(14)}| ${a.title.substring(0, 60)}`
    );
  }

  // Zusammenfassung vorab
  const byCat: Record<string, number> = {};
  const byFunnel: Record<string, number> = {};
  for (const a of assignments) {
    byCat[a.ratgeberCategory] = (byCat[a.ratgeberCategory] || 0) + 1;
    byFunnel[a.funnel] = (byFunnel[a.funnel] || 0) + 1;
  }

  console.log("\n📊 Verteilung nach Ratgeber-Kategorie:");
  for (const [cat, count] of Object.entries(byCat)) {
    console.log(`   ${cat}: ${count}`);
  }
  console.log("\n📊 Verteilung nach Funnel:");
  for (const [f, count] of Object.entries(byFunnel)) {
    console.log(`   ${f}: ${count}`);
  }

  // In DB importieren
  console.log(`\n🚀 Importiere ${assignments.length} Einträge in die Datenbank...`);

  let created = 0;
  for (const a of assignments) {
    await prisma.editorialPlanEntry.create({
      data: {
        title: a.title,
        ratgeberCategory: a.ratgeberCategory,
        funnel: a.funnel,
        status: "planned",
        dueDate: a.dueDate,
        creatorId: creator.id,
      },
    });
    created++;

    if (created % 20 === 0) {
      console.log(`   ${created}/${assignments.length} erstellt...`);
    }
  }

  console.log(`\n✅ Import abgeschlossen: ${created} Einträge erstellt`);

  const firstDate = assignments[0].dueDate.toLocaleDateString("de-DE");
  const lastDate = assignments[assignments.length - 1].dueDate.toLocaleDateString("de-DE");
  console.log(`📅 Zeitraum: ${firstDate} – ${lastDate}`);
  console.log(`   Ca. alle ${interval.toFixed(1)} Wochentage ein neuer Artikel`);
}

importRedaktionsplan()
  .catch((e) => {
    console.error("❌ Fehler:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
