import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFullAdminRights } from "@/lib/rbac";

// GET - Briefing-Statistiken für Auswertung
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
    }

    // Nur Admins/Agentur können die Statistiken sehen
    if (!hasFullAdminRights(user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const now = new Date();
    
    // Datumsberechnung für verschiedene Zeiträume
    const date30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const date60DaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const date90DaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const date180DaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Alle Briefings für Statistiken laden
    const allBriefings = await prisma.briefing.findMany({
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Anzahl Briefings nach Zeitraum
    const briefingsLast30Days = allBriefings.filter(b => new Date(b.createdAt) >= date30DaysAgo).length;
    const briefingsLast60Days = allBriefings.filter(b => new Date(b.createdAt) >= date60DaysAgo).length;
    const briefingsLast90Days = allBriefings.filter(b => new Date(b.createdAt) >= date90DaysAgo).length;
    const briefingsLast180Days = allBriefings.filter(b => new Date(b.createdAt) >= date180DaysAgo).length;

    // Briefings pro User (Besteller)
    const briefingsByUser: Record<string, { 
      userId: string; 
      name: string; 
      email: string; 
      total: number;
      ordered: number;
      inProgress: number;
      inReview: number;
      completed: number;
      last30Days: number;
    }> = {};

    allBriefings.forEach(briefing => {
      const requesterId = briefing.requester.id;
      if (!briefingsByUser[requesterId]) {
        briefingsByUser[requesterId] = {
          userId: requesterId,
          name: briefing.requester.name || "",
          email: briefing.requester.email,
          total: 0,
          ordered: 0,
          inProgress: 0,
          inReview: 0,
          completed: 0,
          last30Days: 0,
        };
      }
      briefingsByUser[requesterId].total++;
      
      // Status zählen
      if (briefing.status === "ordered") {
        briefingsByUser[requesterId].ordered++;
      } else if (briefing.status === "in_progress") {
        briefingsByUser[requesterId].inProgress++;
      } else if (briefing.status === "in_review") {
        briefingsByUser[requesterId].inReview++;
      } else if (briefing.status === "completed") {
        briefingsByUser[requesterId].completed++;
      }
      
      // Letzte 30 Tage
      if (new Date(briefing.createdAt) >= date30DaysAgo) {
        briefingsByUser[requesterId].last30Days++;
      }
    });

    const userStats = Object.values(briefingsByUser).sort((a, b) => b.total - a.total);

    // Durchschnittliche Bearbeitungsdauer (nur für abgeschlossene Briefings)
    const completedBriefings = allBriefings.filter(b => b.status === "completed");
    let avgProcessingTimeMs = 0;
    let avgProcessingTimeDays = 0;
    
    if (completedBriefings.length > 0) {
      const totalProcessingTime = completedBriefings.reduce((sum, briefing) => {
        const created = new Date(briefing.createdAt).getTime();
        const updated = new Date(briefing.updatedAt).getTime();
        return sum + (updated - created);
      }, 0);
      
      avgProcessingTimeMs = totalProcessingTime / completedBriefings.length;
      avgProcessingTimeDays = Math.round(avgProcessingTimeMs / (1000 * 60 * 60 * 24) * 10) / 10; // 1 Dezimalstelle
    }

    // Statistiken nach Briefing-Typ
    const byType = {
      new_content: {
        total: allBriefings.filter(b => b.briefingType === "new_content").length,
        completed: allBriefings.filter(b => b.briefingType === "new_content" && b.status === "completed").length,
        inReview: allBriefings.filter(b => b.briefingType === "new_content" && b.status === "in_review").length,
        inProgress: allBriefings.filter(b => b.briefingType === "new_content" && b.status === "in_progress").length,
        ordered: allBriefings.filter(b => b.briefingType === "new_content" && b.status === "ordered").length,
      },
      edit_content: {
        total: allBriefings.filter(b => b.briefingType === "edit_content").length,
        completed: allBriefings.filter(b => b.briefingType === "edit_content" && b.status === "completed").length,
        inReview: allBriefings.filter(b => b.briefingType === "edit_content" && b.status === "in_review").length,
        inProgress: allBriefings.filter(b => b.briefingType === "edit_content" && b.status === "in_progress").length,
        ordered: allBriefings.filter(b => b.briefingType === "edit_content" && b.status === "ordered").length,
      },
      lexicon: {
        total: allBriefings.filter(b => b.briefingType === "lexicon").length,
        completed: allBriefings.filter(b => b.briefingType === "lexicon" && b.status === "completed").length,
        inReview: allBriefings.filter(b => b.briefingType === "lexicon" && b.status === "in_review").length,
        inProgress: allBriefings.filter(b => b.briefingType === "lexicon" && b.status === "in_progress").length,
        ordered: allBriefings.filter(b => b.briefingType === "lexicon" && b.status === "ordered").length,
      },
    };

    // Statistiken nach Kategorie (gleiche Kategorien wie bei KVP)
    const CATEGORIES = ["Konto & Karten", "Kredit & Finanzierung", "Sparen & Investieren", "Schutz & Vorsorge"];
    const byCategory: Record<string, { total: number; completed: number; inReview: number; inProgress: number; ordered: number }> = {};
    
    // Initialisiere alle Kategorien
    CATEGORIES.forEach(cat => {
      byCategory[cat] = {
        total: allBriefings.filter(b => b.category === cat).length,
        completed: allBriefings.filter(b => b.category === cat && b.status === "completed").length,
        inReview: allBriefings.filter(b => b.category === cat && b.status === "in_review").length,
        inProgress: allBriefings.filter(b => b.category === cat && b.status === "in_progress").length,
        ordered: allBriefings.filter(b => b.category === cat && b.status === "ordered").length,
      };
    });
    
    // Briefings ohne Kategorie
    byCategory["Keine Kategorie"] = {
      total: allBriefings.filter(b => !b.category).length,
      completed: allBriefings.filter(b => !b.category && b.status === "completed").length,
      inReview: allBriefings.filter(b => !b.category && b.status === "in_review").length,
      inProgress: allBriefings.filter(b => !b.category && b.status === "in_progress").length,
      ordered: allBriefings.filter(b => !b.category && b.status === "ordered").length,
    };

    // Status-Übersicht
    const statusOverview = {
      total: allBriefings.length,
      ordered: allBriefings.filter(b => b.status === "ordered").length,
      inProgress: allBriefings.filter(b => b.status === "in_progress").length,
      inReview: allBriefings.filter(b => b.status === "in_review").length,
      completed: allBriefings.filter(b => b.status === "completed").length,
    };

    // Überfällige Briefings (Deadline überschritten und nicht completed oder in_review)
    const overdueBriefings = allBriefings.filter(b => 
      b.deadline && 
      new Date(b.deadline) < now && 
      b.status !== "completed" &&
      b.status !== "in_review"
    ).length;

    // Monatliche Entwicklung (letzte 6 Monate)
    const monthlyTrend: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const count = allBriefings.filter(b => {
        const created = new Date(b.createdAt);
        return created >= monthStart && created <= monthEnd;
      }).length;
      
      monthlyTrend.push({
        month: monthStart.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
        count,
      });
    }

    return NextResponse.json({
      timeBasedStats: {
        last30Days: briefingsLast30Days,
        last60Days: briefingsLast60Days,
        last90Days: briefingsLast90Days,
        last180Days: briefingsLast180Days,
      },
      userStats,
      processingTime: {
        avgDays: avgProcessingTimeDays,
        completedCount: completedBriefings.length,
      },
      byType,
      byCategory,
      statusOverview,
      overdueBriefings,
      monthlyTrend,
    });
  } catch (error) {
    console.error("Error fetching briefing stats:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Statistiken" }, { status: 500 });
  }
}
