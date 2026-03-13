import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST - Keyword hinzufügen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { keyword, category, targetUrl } = body;

    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: "Keyword ist erforderlich" },
        { status: 400 }
      );
    }

    // Validiere Kategorie
    const validCategories = ["Konto & Karten", "Kredit & Finanzierung", "Sparen & Investieren", "Schutz & Vorsorge", "Baufinanzierung"];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Ungültige Kategorie" },
        { status: 400 }
      );
    }

    // Hole oder erstelle Tracker (teamweiter Zugriff - alle User teilen sich einen Tracker)
    let tracker = await prisma.rankTracker.findFirst();

    if (!tracker) {
      tracker = await prisma.rankTracker.create({
        data: {
          userId: session.user.id,
          name: "Standard Tracker",
          location: "Germany",
          language: "German",
        },
      });
    }

    // Prüfe ob Keyword bereits existiert
    const existingKeyword = await prisma.rankTrackerKeyword.findUnique({
      where: {
        trackerId_keyword: {
          trackerId: tracker.id,
          keyword: keyword.trim(),
        },
      },
    });

    if (existingKeyword) {
      return NextResponse.json(
        { error: "Keyword existiert bereits" },
        { status: 400 }
      );
    }

    // Erstelle Keyword
    const newKeyword = await prisma.rankTrackerKeyword.create({
      data: {
        trackerId: tracker.id,
        keyword: keyword.trim(),
        category: category || null,
        targetUrl: targetUrl?.trim() || null,
      },
    });

    return NextResponse.json({ keyword: newKeyword });
  } catch (error) {
    console.error("Error adding keyword:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Keyword existiert bereits" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to add keyword" },
      { status: 500 }
    );
  }
}
