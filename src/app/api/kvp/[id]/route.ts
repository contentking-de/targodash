import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// GET - Einzelne KVP URL abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Teamweiter Zugriff - alle können lesen
    const kvpUrl = await prisma.kVPUrl.findFirst({
      where: {
        id,
      },
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
    });

    if (!kvpUrl) {
      return NextResponse.json({ error: "KVP URL not found" }, { status: 404 });
    }

    return NextResponse.json({ url: kvpUrl });
  } catch (error) {
    console.error("Error fetching KVP URL:", error);
    return NextResponse.json(
      { error: "Failed to fetch KVP URL" },
      { status: 500 }
    );
  }
}

// PATCH - KVP URL aktualisieren
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { url, focusKeyword, category, comment, assigneeIds } = body;

    // Validiere Kategorie falls angegeben
    if (category) {
      const validCategories = ["Konto & Karten", "Kredit & Finanzierung", "Sparen & Investieren", "Schutz & Vorsorge", "Baufinanzierung"];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: "Ungültige Kategorie" },
          { status: 400 }
        );
      }
    }

    // Prüfen ob die URL existiert (teamweiter Zugriff - alle können bearbeiten)
    const existingUrl = await prisma.kVPUrl.findFirst({
      where: {
        id,
      },
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
    });

    if (!existingUrl) {
      return NextResponse.json({ error: "KVP URL not found" }, { status: 404 });
    }

    // Bestimme die finale URL (neu oder bestehend)
    const finalUrl = url || existingUrl.url;
    // Bestimme das finale Fokuskeyword (neu oder bestehend)
    const finalFocusKeyword = focusKeyword || existingUrl.focusKeyword;

    // Wenn assigneeIds übergeben wurden, aktualisiere die Zuweisungen
    if (assigneeIds !== undefined) {
      // Lösche alle bestehenden Zuweisungen
      await prisma.$executeRaw`DELETE FROM "KVPAssignee" WHERE "kvpUrlId" = ${id}`;
      
      // Erstelle neue Zuweisungen
      if (Array.isArray(assigneeIds) && assigneeIds.length > 0) {
        for (const userId of assigneeIds) {
          const assigneeId = `a${randomBytes(16).toString('hex')}`;
          await prisma.$executeRaw`
            INSERT INTO "KVPAssignee" ("id", "kvpUrlId", "userId", "createdAt")
            VALUES (${assigneeId}, ${id}, ${userId}, NOW())
          `;
        }
      }
    }

    const kvpUrl = await prisma.kVPUrl.update({
      where: { id },
      data: {
        ...(url && { url }),
        ...(focusKeyword && { focusKeyword }),
        ...(category !== undefined && { category: (category || null) as any }), // Type assertion bis Prisma Client neu generiert wurde
        ...(comment !== undefined && { comment: comment || null }), // Deprecated, wird durch comments ersetzt
      },
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
    });

    // Füge Keywords zum Ranktracker hinzu (falls noch nicht vorhanden)
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

    // Bestimme die finale Kategorie (neu oder bestehend)
    const finalCategory = category || (existingUrl as any).category;

    // Sammle alle Keywords (Fokuskeyword + Subkeywords)
    const allKeywords = [
      finalFocusKeyword.trim(),
      ...((kvpUrl as any).subkeywords || []).map((s: { keyword: string }) => s.keyword.trim()),
    ];

    // Füge Keywords zum Ranktracker hinzu (falls noch nicht vorhanden)
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
          // Keyword existiert nicht, füge es hinzu
          await prisma.rankTrackerKeyword.create({
            data: {
              trackerId: tracker.id,
              keyword: keyword,
              targetUrl: finalUrl.trim(),
              category: finalCategory || null,
            },
          });
        } catch (error) {
          // Ignoriere Fehler wenn Keyword bereits existiert (Race Condition)
          console.log(`Keyword "${keyword}" konnte nicht hinzugefügt werden, möglicherweise bereits vorhanden`);
        }
      } else {
        // Wenn Keyword existiert, aktualisiere targetUrl und category falls nötig
        const updateData: { targetUrl?: string; category?: string | null } = {};
        if (!existingKeyword.targetUrl || existingKeyword.targetUrl !== finalUrl.trim()) {
          updateData.targetUrl = finalUrl.trim();
        }
        if (finalCategory && existingKeyword.category !== finalCategory) {
          updateData.category = finalCategory;
        }
        if (Object.keys(updateData).length > 0) {
          await prisma.rankTrackerKeyword.update({
            where: { id: existingKeyword.id },
            data: updateData,
          });
        }
      }
    }

    return NextResponse.json({ url: kvpUrl });
  } catch (error) {
    console.error("Error updating KVP URL:", error);
    return NextResponse.json(
      { error: "Failed to update KVP URL" },
      { status: 500 }
    );
  }
}

// DELETE - KVP URL löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Prüfen ob die URL dem User gehört
    const existingUrl = await prisma.kVPUrl.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingUrl) {
      return NextResponse.json({ error: "KVP URL not found" }, { status: 404 });
    }

    await prisma.kVPUrl.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting KVP URL:", error);
    return NextResponse.json(
      { error: "Failed to delete KVP URL" },
      { status: 500 }
    );
  }
}
