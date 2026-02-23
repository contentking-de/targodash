import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchRankings, findRankingPosition } from "@/lib/dataforseo";
import { NextRequest, NextResponse } from "next/server";

// POST - Rankings für alle oder ein einzelnes Keyword abrufen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prüfe ob nur ein bestimmtes Keyword aktualisiert werden soll
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId");

    // Hole Tracker mit Keywords (teamweiter Zugriff - alle User teilen sich einen Tracker)
    let tracker = await prisma.rankTracker.findFirst({
      include: {
        keywords: keywordId
          ? { where: { id: keywordId } }
          : true,
      },
    });

    if (!tracker || tracker.keywords.length === 0) {
      return NextResponse.json(
        { error: keywordId ? "Keyword nicht gefunden" : "Keine Keywords zum Tracken vorhanden" },
        { status: 400 }
      );
    }

    // Stelle sicher, dass Location auf Germany gesetzt ist
    if (tracker.location !== "Germany") {
      console.log(`[fetchRankings] Aktualisiere Location von "${tracker.location}" auf "Germany"`);
      tracker = await prisma.rankTracker.update({
        where: { id: tracker.id },
        data: { location: "Germany" },
        include: {
          keywords: true,
        },
      });
    }

    // Bereite Keywords für DataForSEO vor
    const keywords = tracker.keywords.map((k) => ({
      keyword: k.keyword,
      targetUrl: k.targetUrl,
    }));
    
    // ERZWINGE IMMER Deutschland für Rankings
    const forcedLocation = "Germany";
    const forcedLanguage = tracker.language || "German";
    
    console.log(`[fetchRankings] Starte Ranking-Abruf für ${tracker.keywords.length} Keywords`);
    console.log(`[fetchRankings] Location: ${forcedLocation} (ERZWUNGEN), Language: ${forcedLanguage}`);
    console.log(`[fetchRankings] Keywords:`, tracker.keywords.map(k => ({ keyword: k.keyword, targetUrl: k.targetUrl || "targobank.de (Standard)" })));
    
    // Rufe Rankings ab - IMMER für Deutschland
    const results = await fetchRankings(
      keywords,
      forcedLocation,
      forcedLanguage
    );

    console.log(`[fetchRankings] DataForSEO API hat ${results.length} Results zurückgegeben`);
    console.log(`[fetchRankings] Results:`, results.map(r => ({
      keyword: r.keyword,
      itemsCount: r.items_count,
      firstItem: r.items?.[0] ? {
        rank: r.items[0].rank_absolute,
        url: r.items[0].url,
        domain: r.items[0].domain,
      } : null,
    })));

    // Speichere Rankings in Datenbank
    const savedRankings = [];
    for (const keyword of tracker.keywords) {
      // Wenn keine targetUrl angegeben, verwende automatisch targobank.de
      const targetUrl = keyword.targetUrl || "targobank.de";
      console.log(`[fetchRankings] Verarbeite Keyword: "${keyword.keyword}" mit Target: "${targetUrl}"`);
      
      const rankingData = findRankingPosition(results, keyword.keyword, targetUrl);
      
      console.log(`[fetchRankings] Ranking-Daten für "${keyword.keyword}":`, rankingData);
      
      // Speichere Ranking (auch wenn position null ist - zeigt an, dass wir geprüft haben)
      const ranking = await prisma.rankTrackerRanking.create({
        data: {
          keywordId: keyword.id,
          position: rankingData.position, // null wenn nicht in Top 100
          url: rankingData.url,
          date: new Date(),
        },
      });

      savedRankings.push({
        keyword: keyword.keyword,
        ranking,
      });
      
      if (rankingData.position === null) {
        console.log(`[fetchRankings] "${keyword.keyword}" nicht in Top 100 gefunden - Zeitstempel gespeichert`);
      }
    }
    
    console.log(`[fetchRankings] Gespeicherte Rankings:`, savedRankings.map(s => ({
      keyword: s.keyword,
      position: s.ranking.position,
      url: s.ranking.url,
    })));

    return NextResponse.json({
      success: true,
      rankings: savedRankings,
      message: `${savedRankings.length} Rankings erfolgreich abgerufen`,
    });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch rankings",
      },
      { status: 500 }
    );
  }
}
