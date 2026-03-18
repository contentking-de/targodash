import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFullAdminRights } from "@/lib/rbac";
import { sendBriefingCompletedNotification } from "@/lib/resend";
import { createNotification } from "@/lib/notifications";

// GET - Einzelnes Briefing laden
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const briefing = await prisma.briefing.findUnique({
      where: { id },
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
    });

    if (!briefing) {
      return NextResponse.json({ error: "Briefing nicht gefunden" }, { status: 404 });
    }

    // Zugriffskontrolle: Member sehen nur eigene Briefings, Agentur/Superadmin alle
    if (!hasFullAdminRights(user.role) && briefing.requesterId !== user.id) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    return NextResponse.json({ briefing });
  } catch (error) {
    console.error("Error fetching briefing:", error);
    return NextResponse.json({ error: "Fehler beim Laden des Briefings" }, { status: 500 });
  }
}

// PATCH - Briefing aktualisieren
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const briefing = await prisma.briefing.findUnique({
      where: { id },
    });

    if (!briefing) {
      return NextResponse.json({ error: "Briefing nicht gefunden" }, { status: 404 });
    }

    const body = await request.json();
    const isAdmin = hasFullAdminRights(user.role);
    const isOwner = briefing.requesterId === user.id;

    // Nur Admins können Content-Felder bearbeiten, Owner können Grunddaten ändern
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    // Aufteilen der erlaubten Felder basierend auf der Rolle
    const updateData: Record<string, unknown> = {};

    // Grunddaten - können vom Owner oder Admin geändert werden (nur wenn Status "ordered")
    if ((isOwner || isAdmin) && briefing.status === "ordered") {
      if (body.title !== undefined) updateData.title = body.title;
      if (body.briefingType !== undefined) updateData.briefingType = body.briefingType;
      if (body.category !== undefined) updateData.category = body.category || null;
      if (body.contentAction !== undefined) updateData.contentAction = body.contentAction;
      if (body.targetAudience !== undefined) updateData.targetAudience = body.targetAudience;
      if (body.funnelStage !== undefined) updateData.funnelStage = body.funnelStage;
      if (body.goals !== undefined) updateData.goals = body.goals;
      if (body.focusKeyword !== undefined) updateData.focusKeyword = body.focusKeyword;
      if (body.keywordCluster !== undefined) updateData.keywordCluster = body.keywordCluster;
      if (body.topicCluster !== undefined) updateData.topicCluster = body.topicCluster;
      if (body.searchIntent !== undefined) updateData.searchIntent = body.searchIntent;
      if (body.url !== undefined) updateData.url = body.url;
      if (body.benchmarkUrls !== undefined) updateData.benchmarkUrls = body.benchmarkUrls;
      if (body.csArticle !== undefined) updateData.csArticle = body.csArticle;
      // Lexikon-Felder
      if (body.lexiconDefinition !== undefined) updateData.lexiconDefinition = body.lexiconDefinition;
      if (body.lexiconSynonyms !== undefined) updateData.lexiconSynonyms = body.lexiconSynonyms;
      if (body.lexiconRelated !== undefined) updateData.lexiconRelated = body.lexiconRelated;
    }

    // Content-Felder - nur Admins (Agentur/Superadmin)
    if (isAdmin) {
      if (body.status !== undefined) updateData.status = body.status;
      if (body.assigneeId !== undefined) updateData.assigneeId = body.assigneeId;
      if (body.deadline !== undefined) updateData.deadline = body.deadline ? new Date(body.deadline) : null;
      if (body.titleTag !== undefined) updateData.titleTag = body.titleTag;
      if (body.metaDescription !== undefined) updateData.metaDescription = body.metaDescription;
      if (body.navTitle !== undefined) updateData.navTitle = body.navTitle;
      if (body.h1 !== undefined) updateData.h1 = body.h1;
      if (body.mainParagraph !== undefined) updateData.mainParagraph = body.mainParagraph;
      if (body.primaryCta !== undefined) updateData.primaryCta = body.primaryCta;
      if (body.secondaryCta !== undefined) updateData.secondaryCta = body.secondaryCta;
      if (body.inboundCta !== undefined) updateData.inboundCta = body.inboundCta;
      if (body.keywordsetLongtail !== undefined) updateData.keywordsetLongtail = body.keywordsetLongtail;
      if (body.topicclusterContent !== undefined) updateData.topicclusterContent = body.topicclusterContent;
      if (body.bodyContent !== undefined) updateData.bodyContent = body.bodyContent;
      if (body.internalLinks !== undefined) updateData.internalLinks = body.internalLinks;
      if (body.missingTopics !== undefined) updateData.missingTopics = body.missingTopics;
      if (body.faqs !== undefined) updateData.faqs = body.faqs;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.titleEn !== undefined) updateData.titleEn = body.titleEn;
      if (body.titleFr !== undefined) updateData.titleFr = body.titleFr;
      if (body.titleIt !== undefined) updateData.titleIt = body.titleIt;
      if (body.diagramUrl !== undefined) updateData.diagramUrl = body.diagramUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Keine Änderungen oder keine Berechtigung für diese Änderungen" },
        { status: 400 }
      );
    }

    // Prüfen ob Status auf "completed" geändert wird
    const statusChangedToCompleted = 
      body.status === "completed" && briefing.status !== "completed";

    const updatedBriefing = await prisma.briefing.update({
      where: { id },
      data: updateData,
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
    });

    // E-Mail an Besteller senden wenn Status auf "completed" geändert wurde
    if (statusChangedToCompleted) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        const dashboardUrl = `${baseUrl}/briefings`;

        await sendBriefingCompletedNotification({
          to: updatedBriefing.requester.email,
          briefingTitle: updatedBriefing.title,
          briefingNumber: updatedBriefing.briefingNumber,
          dashboardUrl,
        });

        await createNotification({
          userId: updatedBriefing.requester.id,
          type: "briefing_completed",
          title: `Briefing fertiggestellt: #${updatedBriefing.briefingNumber}`,
          message: `Dein Briefing "${updatedBriefing.title}" wurde fertiggestellt.`,
          link: "/briefings",
        });
      } catch (emailError) {
        // E-Mail-Fehler loggen, aber Update nicht abbrechen
        console.error("Error sending briefing completed notification:", emailError);
      }
    }

    return NextResponse.json({ briefing: updatedBriefing });
  } catch (error) {
    console.error("Error updating briefing:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren des Briefings" }, { status: 500 });
  }
}

// DELETE - Briefing löschen
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Nur Admins können Briefings löschen
    if (!hasFullAdminRights(user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.briefing.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting briefing:", error);
    return NextResponse.json({ error: "Fehler beim Löschen des Briefings" }, { status: 500 });
  }
}
