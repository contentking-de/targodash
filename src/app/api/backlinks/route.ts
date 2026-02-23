import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchBacklinks, fetchBacklinksSummary, fetchReferringDomains } from "@/lib/dataforseo";

// GET /api/backlinks - Liest gespeicherte Backlink-Daten aus der Datenbank
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "backlinks"; // backlinks, summary, domains
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");
    
    // Filter-Parameter
    const dofollow = searchParams.get("dofollow");
    const isNew = searchParams.get("isNew");
    const isLost = searchParams.get("isLost");

    console.log(`[API GET /api/backlinks] Request: type=${type}, limit=${limit}, offset=${offset}`);

    // Hole das aktuelle Profil (es gibt nur eines für targobank.de)
    const profile = await prisma.backlinkProfile.findFirst({
      where: { target: "targobank.de" },
      orderBy: { updatedAt: "desc" },
    });

    if (!profile) {
      return NextResponse.json({
        message: "Noch keine Daten vorhanden. Bitte klicke auf 'Aktualisieren' um Daten abzurufen.",
        needsRefresh: true,
        summary: null,
        backlinks: [],
        domains: [],
        total_count: 0,
        items_count: 0,
      });
    }

    if (type === "summary") {
      // Summary aus DB
      return NextResponse.json({
        summary: {
          target: profile.target,
          total_backlinks: profile.totalBacklinks,
          total_referring_domains: profile.totalReferringDomains,
          total_referring_main_domains: profile.totalReferringMainDomains,
          total_referring_ips: profile.totalReferringIps,
          total_referring_subnets: profile.totalReferringSubnets,
          dofollow: profile.dofollow,
          nofollow: profile.nofollow,
          new_backlinks: profile.newBacklinks,
          lost_backlinks: profile.lostBacklinks,
        },
        lastUpdated: profile.updatedAt,
      });
    } else if (type === "domains") {
      // Referring Domains aus DB
      const totalCount = await prisma.referringDomain.count({
        where: { profileId: profile.id },
      });

      const domains = await prisma.referringDomain.findMany({
        where: { profileId: profile.id },
        orderBy: { rank: "desc" },
        skip: offset,
        take: limit,
      });

      return NextResponse.json({
        domains: domains.map((d) => ({
          type: "referring_domain",
          domain: d.domain,
          rank: d.rank,
          backlinks: d.backlinks,
          first_seen: d.firstSeen?.toISOString() || null,
          backlinks_spam_score: d.backlinksSpamScore,
        })),
        total_count: totalCount,
        items_count: domains.length,
        lastUpdated: profile.updatedAt,
      });
    } else {
      // Backlinks aus DB mit Filtern
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { profileId: profile.id };
      
      if (dofollow !== null) {
        where.dofollow = dofollow === "true";
      }
      if (isNew === "true") {
        where.isNew = true;
      }
      if (isLost === "true") {
        where.isLost = true;
      }

      const totalCount = await prisma.backlink.count({ where });

      const backlinks = await prisma.backlink.findMany({
        where,
        orderBy: { rank: "desc" },
        skip: offset,
        take: limit,
      });

      return NextResponse.json({
        backlinks: backlinks.map((bl) => ({
          type: "backlink",
          domain_from: bl.domainFrom,
          url_from: bl.urlFrom,
          url_to: bl.urlTo,
          tld_from: bl.tldFrom,
          rank: bl.rank,
          page_from_rank: bl.pageFromRank,
          domain_from_rank: bl.domainFromRank,
          domain_from_country: bl.domainFromCountry,
          page_from_title: bl.pageFromTitle,
          first_seen: bl.firstSeen?.toISOString() || null,
          last_seen: bl.lastSeen?.toISOString() || null,
          item_type: bl.itemType,
          dofollow: bl.dofollow,
          anchor: bl.anchor,
          is_new: bl.isNew,
          is_lost: bl.isLost,
          backlink_spam_score: bl.backlinkSpamScore,
        })),
        total_count: totalCount,
        items_count: backlinks.length,
        target: profile.target,
        lastUpdated: profile.updatedAt,
      });
    }
  } catch (error) {
    console.error("[API GET /api/backlinks] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Laden der Backlinks" },
      { status: 500 }
    );
  }
}

// POST /api/backlinks - Aktualisiert die Backlink-Daten von DataForSEO
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    console.log("[API POST /api/backlinks] Starte Aktualisierung von DataForSEO...");

    // 1. Summary abrufen
    console.log("[API POST /api/backlinks] Rufe Summary ab...");
    const summary = await fetchBacklinksSummary();

    // 2. Backlinks abrufen (erste 1000)
    console.log("[API POST /api/backlinks] Rufe Backlinks ab...");
    const backlinksResult = await fetchBacklinks(1000, 0, "rank,desc");

    // 3. Referring Domains abrufen (erste 500)
    console.log("[API POST /api/backlinks] Rufe Referring Domains ab...");
    const domainsResult = await fetchReferringDomains(500, 0, "rank,desc");

    // 4. Altes Profil löschen (falls vorhanden)
    console.log("[API POST /api/backlinks] Lösche alte Daten...");
    await prisma.backlinkProfile.deleteMany({
      where: { target: "targobank.de" },
    });

    // 5. Neues Profil erstellen
    console.log("[API POST /api/backlinks] Erstelle neues Profil...");
    const profile = await prisma.backlinkProfile.create({
      data: {
        target: "targobank.de",
        totalBacklinks: summary.total_backlinks,
        totalReferringDomains: summary.total_referring_domains,
        totalReferringMainDomains: summary.total_referring_main_domains,
        totalReferringIps: summary.total_referring_ips,
        totalReferringSubnets: summary.total_referring_subnets,
        dofollow: summary.dofollow,
        nofollow: summary.nofollow,
        newBacklinks: summary.new_backlinks,
        lostBacklinks: summary.lost_backlinks,
      },
    });

    // 6. Backlinks speichern
    console.log(`[API POST /api/backlinks] Speichere ${backlinksResult.items.length} Backlinks...`);
    if (backlinksResult.items.length > 0) {
      await prisma.backlink.createMany({
        data: backlinksResult.items.map((bl) => ({
          profileId: profile.id,
          domainFrom: bl.domain_from,
          urlFrom: bl.url_from,
          urlTo: bl.url_to,
          tldFrom: bl.tld_from || null,
          rank: bl.rank || 0,
          pageFromRank: bl.page_from_rank || 0,
          domainFromRank: bl.domain_from_rank || 0,
          domainFromCountry: bl.domain_from_country || null,
          pageFromTitle: bl.page_from_title || null,
          firstSeen: bl.first_seen ? new Date(bl.first_seen) : null,
          lastSeen: bl.last_seen ? new Date(bl.last_seen) : null,
          itemType: bl.item_type || null,
          dofollow: bl.dofollow ?? true,
          anchor: bl.anchor || null,
          isNew: bl.is_new ?? false,
          isLost: bl.is_lost ?? false,
          backlinkSpamScore: bl.backlink_spam_score || 0,
        })),
      });
    }

    // 7. Referring Domains speichern
    console.log(`[API POST /api/backlinks] Speichere ${domainsResult.items.length} Referring Domains...`);
    if (domainsResult.items.length > 0) {
      await prisma.referringDomain.createMany({
        data: domainsResult.items.map((d) => ({
          profileId: profile.id,
          domain: d.domain,
          rank: d.rank || 0,
          backlinks: d.backlinks || 0,
          firstSeen: d.first_seen ? new Date(d.first_seen) : null,
          backlinksSpamScore: d.backlinks_spam_score || 0,
        })),
      });
    }

    console.log("[API POST /api/backlinks] ✓ Aktualisierung abgeschlossen!");

    return NextResponse.json({
      success: true,
      message: `Linkprofil aktualisiert: ${backlinksResult.items.length} Backlinks, ${domainsResult.items.length} Referring Domains gespeichert.`,
      summary: {
        total_backlinks: summary.total_backlinks,
        total_referring_domains: summary.total_referring_domains,
        backlinks_saved: backlinksResult.items.length,
        domains_saved: domainsResult.items.length,
      },
      lastUpdated: profile.updatedAt,
    });
  } catch (error) {
    console.error("[API POST /api/backlinks] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Aktualisieren der Backlinks" },
      { status: 500 }
    );
  }
}
