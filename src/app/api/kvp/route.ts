import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { canEdit } from "@/lib/rbac";

// GET - Alle KVP URLs abrufen (teamweiter Zugriff)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Teamweiter Zugriff - keine userId-Filterung
    const kvpUrls = await prisma.kVPUrl.findMany({
      include: {
        subkeywords: {
          orderBy: { createdAt: "asc" },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
        files: {
          orderBy: { createdAt: "desc" },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      } as any, // Type assertion bis Prisma Client neu generiert wurde
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ urls: kvpUrls });
  } catch (error) {
    console.error("Error fetching KVP URLs:", error);
    return NextResponse.json(
      { error: "Failed to fetch KVP URLs" },
      { status: 500 }
    );
  }
}

// POST - Neue KVP URL erstellen (nur Member und Superadmin)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rollenprüfung: Viewer können nicht bearbeiten
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten" }, { status: 403 });
    }

    const body = await request.json();
    const { url, focusKeyword, category, comment, subkeywords, assigneeIds } = body;

    if (!url || !focusKeyword) {
      return NextResponse.json(
        { error: "URL und Fokuskeyword sind erforderlich" },
        { status: 400 }
      );
    }

    // Validiere Kategorie
    const validCategories = ["Konto & Karten", "Kredit & Finanzierung", "Sparen & Investieren", "Schutz & Vorsorge"];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: "Ungültige Kategorie" },
        { status: 400 }
      );
    }

    // Erstelle KVP URL
    const kvpUrl = await prisma.kVPUrl.create({
      data: {
        url,
        focusKeyword,
        ...(category && { category: category as any }), // Type assertion bis Prisma Client neu generiert wurde
        comment: comment || null, // Deprecated, wird durch comments ersetzt
        userId: session.user.id,
        subkeywords: {
          create: (subkeywords || []).map((keyword: string) => ({
            keyword: keyword.trim(),
          })),
        },
        // Erstelle Nutzerzuweisungen
        assignees: {
          create: (assigneeIds || []).map((userId: string) => ({
            userId,
          })),
        },
      } as any,
      include: {
        subkeywords: {
          orderBy: { createdAt: "asc" },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Erstelle Kommentar, falls vorhanden (über direkte SQL-Abfrage, da Prisma Client noch nicht aktualisiert)
    let comments: any[] = [];
    if (comment && comment.trim()) {
      try {
        // Generiere eine ID (ähnlich wie cuid)
        const commentId = `c${randomBytes(16).toString('hex')}`;
        const now = new Date();
        
        // Verwende Prisma mit Raw SQL, da der Client noch nicht aktualisiert wurde
        const result = await prisma.$queryRaw<any[]>`
          INSERT INTO "KVPComment" ("id", "urlId", "text", "createdAt", "updatedAt")
          VALUES (${commentId}, ${kvpUrl.id}, ${comment.trim()}, ${now}, ${now})
          RETURNING *
        `;
        
        if (result && result.length > 0) {
          comments = [result[0]];
        }
      } catch (error) {
        console.error("Error creating comment:", error);
        // Kommentar konnte nicht erstellt werden, aber URL wurde erstellt
      }
    }

    const kvpUrlWithComments = {
      ...kvpUrl,
      comments,
      assignees: (kvpUrl as any).assignees || [],
    };

    // Hole oder erstelle Rank Tracker
    let tracker = await prisma.rankTracker.findFirst({
      where: { userId: session.user.id },
    });

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

    // Füge Fokuskeyword zum Ranktracker hinzu
    const allKeywords = [focusKeyword.trim(), ...(subkeywords || []).map((k: string) => k.trim())];
    const addedKeywords = [];

    for (const keyword of allKeywords) {
      if (!keyword) continue;

      // Prüfe ob Keyword bereits existiert
      const existingKeyword = await prisma.rankTrackerKeyword.findUnique({
        where: {
          trackerId_keyword: {
            trackerId: tracker.id,
            keyword: keyword,
          },
        },
      });

      if (!existingKeyword) {
        try {
          const rankKeyword = await prisma.rankTrackerKeyword.create({
            data: {
              trackerId: tracker.id,
              keyword: keyword,
              targetUrl: url.trim(), // Setze die KVP URL als targetUrl
              category: category || null, // Verwende die Kategorie aus dem KVP
            },
          });
          addedKeywords.push(rankKeyword);
        } catch (error) {
          // Ignoriere Fehler wenn Keyword bereits existiert (Race Condition)
          console.log(`Keyword "${keyword}" konnte nicht hinzugefügt werden, möglicherweise bereits vorhanden`);
        }
      } else {
        // Wenn Keyword existiert, aktualisiere targetUrl und category falls nötig
        const updateData: { targetUrl?: string; category?: string | null } = {};
        if (!existingKeyword.targetUrl || existingKeyword.targetUrl !== url.trim()) {
          updateData.targetUrl = url.trim();
        }
        if (category && existingKeyword.category !== category) {
          updateData.category = category;
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.rankTrackerKeyword.update({
            where: { id: existingKeyword.id },
            data: updateData,
          });
        }
        addedKeywords.push(existingKeyword);
      }
    }

    return NextResponse.json({ 
      url: kvpUrlWithComments,
      addedKeywords: addedKeywords.length,
    });
  } catch (error) {
    console.error("Error creating KVP URL:", error);
    return NextResponse.json(
      { error: "Failed to create KVP URL" },
      { status: 500 }
    );
  }
}
