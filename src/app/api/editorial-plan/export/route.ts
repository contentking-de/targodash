import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

const STATUS_LABELS: Record<string, string> = {
  planned: "Geplant",
  in_progress: "In Bearbeitung",
  review: "Review",
  approved: "Freigegeben",
  published: "Veröffentlicht",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  pm_review: "PM Review",
  brand_review: "Brand-Check",
  brand_approved: "Brand OK",
  compliance_review: "Compliance Review",
  compliance_approved: "Compliance OK",
  legal_review: "Legal Review",
  legal_approved: "Legal OK",
  production_ready: "Production Ready",
  published: "Published",
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await prisma.editorialPlanEntry.findMany({
      include: {
        creator: { select: { name: true, email: true } },
        assignees: {
          include: { user: { select: { name: true, email: true } } },
        },
        article: {
          select: { reviewStatus: true, wordCount: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Redaktionsplan");

    sheet.columns = [
      { header: "Titel", key: "title", width: 40 },
      { header: "Kategorie", key: "category", width: 22 },
      { header: "Ratgeber-Kategorie", key: "ratgeberCategory", width: 25 },
      { header: "Funnel", key: "funnel", width: 16 },
      { header: "Status", key: "status", width: 18 },
      { header: "Fälligkeitsdatum", key: "dueDate", width: 16 },
      { header: "URL", key: "url", width: 45 },
      { header: "Beschreibung", key: "description", width: 40 },
      { header: "Zugewiesen an", key: "assignees", width: 30 },
      { header: "Erstellt von", key: "creator", width: 22 },
      { header: "Content erstellt", key: "contentPushed", width: 16 },
      { header: "Content-Status", key: "reviewStatus", width: 18 },
      { header: "Wörter", key: "wordCount", width: 10 },
      { header: "Erstellt am", key: "createdAt", width: 16 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    headerRow.alignment = { vertical: "middle" };

    for (const entry of entries) {
      sheet.addRow({
        title: entry.title,
        category: entry.category || "",
        ratgeberCategory: entry.ratgeberCategory || "",
        funnel: entry.funnel || "",
        status: STATUS_LABELS[entry.status] || entry.status,
        dueDate: new Date(entry.dueDate).toLocaleDateString("de-DE"),
        url: entry.url || "",
        description: entry.description || "",
        assignees: entry.assignees.map((a) => a.user.name || a.user.email).join(", "),
        creator: entry.creator.name || entry.creator.email,
        contentPushed: entry.contentPushed ? "Ja" : "Nein",
        reviewStatus: entry.article
          ? REVIEW_STATUS_LABELS[entry.article.reviewStatus] || entry.article.reviewStatus
          : "",
        wordCount: entry.article?.wordCount || "",
        createdAt: new Date(entry.createdAt).toLocaleDateString("de-DE"),
      });
    }

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 14 },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    const today = new Date().toISOString().split("T")[0];
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Redaktionsplan_${today}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting editorial plan:", error);
    return NextResponse.json({ error: "Failed to export editorial plan" }, { status: 500 });
  }
}
