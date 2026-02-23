import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit, hasFullAdminRights } from "@/lib/rbac";
import { sendNewBriefingNotification } from "@/lib/resend";

// GET - Liste aller Briefings
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

    // Alle Briefings laden - Member sehen nur ihre eigenen, Agentur/Superadmin sehen alle
    const whereClause = hasFullAdminRights(user.role)
      ? {}
      : { requesterId: user.id };

    const briefings = await prisma.briefing.findMany({
      where: whereClause,
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ briefings });
  } catch (error) {
    console.error("Error fetching briefings:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Briefings" }, { status: 500 });
  }
}

// POST - Neues Briefing erstellen (Bestellung)
export async function POST(request: Request) {
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

    // Nur User mit mindestens "member" Rolle können Briefings bestellen
    if (!canEdit(user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      briefingType,
      category,
      contentAction,
      targetAudience,
      funnelStage,
      goals,
      focusKeyword,
      keywordCluster,
      topicCluster,
      searchIntent,
      url,
      benchmarkUrls,
      csArticle,
      // Lexikon-spezifische Felder
      lexiconDefinition,
      lexiconSynonyms,
      lexiconRelated,
    } = body;

    if (!title?.trim() || !briefingType) {
      return NextResponse.json(
        { error: "Titel und Briefing-Typ sind erforderlich" },
        { status: 400 }
      );
    }

    // Validiere briefingType
    const validTypes = ["new_content", "edit_content", "lexicon"];
    if (!validTypes.includes(briefingType)) {
      return NextResponse.json(
        { error: "Ungültiger Briefing-Typ" },
        { status: 400 }
      );
    }

    // Deadline automatisch auf 10 Tage nach Bestellung setzen
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 10);

    // Briefing erstellen
    const briefing = await prisma.briefing.create({
      data: {
        requesterId: user.id,
        title: title.trim(),
        briefingType,
        category: category || null, // Kategorie (Konto & Karten, Kredit & Finanzierung, Sparen & Investieren, Schutz & Vorsorge)
        contentAction: contentAction || briefingType, // Fallback auf briefingType wenn nicht gesetzt
        targetAudience: targetAudience?.trim() || null,
        funnelStage: funnelStage || null,
        goals: goals?.trim() || null,
        focusKeyword: focusKeyword?.trim() || null,
        keywordCluster: keywordCluster?.trim() || null,
        topicCluster: topicCluster?.trim() || null,
        searchIntent: searchIntent || null,
        url: url?.trim() || null,
        benchmarkUrls: benchmarkUrls?.trim() || null,
        csArticle: csArticle?.trim() || null,
        // Lexikon-Felder
        lexiconDefinition: lexiconDefinition?.trim() || null,
        lexiconSynonyms: lexiconSynonyms?.trim() || null,
        lexiconRelated: lexiconRelated?.trim() || null,
        status: "ordered",
        deadline,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // E-Mail an alle Agentur-User senden
    try {
      const agenturUsers = await prisma.user.findMany({
        where: { role: "agentur" },
        select: { email: true },
      });

      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
      const dashboardUrl = `${baseUrl}/briefings`;

      for (const agenturUser of agenturUsers) {
        await sendNewBriefingNotification({
          to: agenturUser.email,
          briefingTitle: briefing.title,
          briefingNumber: briefing.briefingNumber,
          requesterName: user.name || user.email,
          dashboardUrl,
        });
      }
    } catch (emailError) {
      // E-Mail-Fehler loggen, aber Briefing-Erstellung nicht abbrechen
      console.error("Error sending briefing notification emails:", emailError);
    }

    return NextResponse.json({ briefing }, { status: 201 });
  } catch (error) {
    console.error("Error creating briefing:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen des Briefings" }, { status: 500 });
  }
}
