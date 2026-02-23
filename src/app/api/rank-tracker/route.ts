import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET - Rank Tracker und Keywords abrufen (teamweiter Zugriff)
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Teamweiter Zugriff - Hole den ersten/einzigen Tracker (alle User teilen sich einen Tracker)
    let tracker = await prisma.rankTracker.findFirst({
      include: {
        keywords: {
          include: {
            rankings: {
              orderBy: { date: "desc" },
              take: 10, // Hole mehr Rankings für Entwicklungsanzeige
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Erstelle Tracker falls nicht vorhanden
    if (!tracker) {
      tracker = await prisma.rankTracker.create({
        data: {
          userId: session.user.id,
          name: "Standard Tracker",
          location: "Germany",
          language: "German",
        },
        include: {
          keywords: {
            include: {
              rankings: {
                orderBy: { date: "desc" },
                take: 10,
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    // Hole zusätzlich das erste Ranking für jedes Keyword (für Entwicklung seit Start)
    const keywordIds = tracker.keywords.map((k) => k.id);
    const keywordStrings = tracker.keywords.map((k) => k.keyword.toLowerCase());
    
    // Hole erstes Ranking pro Keyword
    const firstRankings = await prisma.$queryRaw<Array<{
      keywordId: string;
      id: string;
      position: number | null;
      url: string | null;
      date: Date;
    }>>`
      SELECT DISTINCT ON ("keywordId") "keywordId", id, position, url, date
      FROM "RankTrackerRanking"
      WHERE "keywordId" = ANY(${keywordIds})
      ORDER BY "keywordId", date ASC
    `;

    // Erstelle Map für erstes Ranking
    const firstRankingMap = new Map(
      firstRankings.map((r) => [r.keywordId, {
        id: r.id,
        position: r.position,
        url: r.url,
        date: r.date,
      }])
    );

    // Hole alle KVPs mit ihren Keywords
    const kvpUrls = await prisma.kVPUrl.findMany({
      include: {
        subkeywords: true,
      },
    });

    // Erstelle eine Map: keyword (lowercase) -> KVP Info
    const keywordToKvpMap = new Map<string, { id: string; url: string; focusKeyword: string }>();
    
    kvpUrls.forEach((kvp) => {
      // Fokuskeyword
      keywordToKvpMap.set(kvp.focusKeyword.toLowerCase(), {
        id: kvp.id,
        url: kvp.url,
        focusKeyword: kvp.focusKeyword,
      });
      
      // Subkeywords
      kvp.subkeywords.forEach((sub) => {
        keywordToKvpMap.set(sub.keyword.toLowerCase(), {
          id: kvp.id,
          url: kvp.url,
          focusKeyword: kvp.focusKeyword,
        });
      });
    });

    // Füge erstes Ranking, KVP-Info und Suchvolumen zu jedem Keyword hinzu
    const trackerWithFirstRanking = {
      ...tracker,
      keywords: tracker.keywords.map((keyword) => ({
        ...keyword,
        firstRanking: firstRankingMap.get(keyword.id) || null,
        kvp: keywordToKvpMap.get(keyword.keyword.toLowerCase()) || null,
        searchVolume: (keyword as any).searchVolume || null,
        searchVolumeUpdatedAt: (keyword as any).searchVolumeUpdatedAt || null,
      })),
    };

    return NextResponse.json({ tracker: trackerWithFirstRanking });
  } catch (error) {
    console.error("Error fetching rank tracker:", error);
    return NextResponse.json(
      { error: "Failed to fetch rank tracker" },
      { status: 500 }
    );
  }
}
