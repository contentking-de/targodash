import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { sendContentReviewNotification } from "@/lib/resend";
import { isAgentur } from "@/lib/rbac";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["pm_review"],
  pm_review: ["brand_review"],
  brand_review: ["brand_approved"],
  brand_approved: ["compliance_review"],
  compliance_review: ["compliance_approved"],
  compliance_approved: ["legal_review"],
  legal_review: ["legal_approved"],
  legal_approved: ["production_ready"],
  production_ready: ["published"],
  published: [],
};

// Welche Rolle bei welchem neuen Status benachrichtigt wird
const STATUS_NOTIFY_ROLE: Record<string, string> = {
  pm_review: "produktmanagement",
  brand_review: "brand",
  compliance_review: "compliance",
  legal_review: "legal",
  production_ready: "dev",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const article = await prisma.generatedArticle.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(article);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { reviewStatus, htmlContent, eloxxImported, resolveRevision, claim } = body;

  const article = await prisma.generatedArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  }

  // Claim/Unclaim
  if (claim !== undefined && !reviewStatus) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    });

    const updated = await prisma.generatedArticle.update({
      where: { id },
      data: claim
        ? {
            claimedAt: new Date(),
            claimedByUserId: user!.id,
            claimedByName: user!.name || user!.email,
          }
        : {
            claimedAt: null,
            claimedByUserId: null,
            claimedByName: null,
          },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(updated);
  }

  // Überarbeitung als erledigt markieren
  if (resolveRevision !== undefined && !reviewStatus) {
    if (!article.revisionRequestedAt) {
      return NextResponse.json(
        { error: "Keine offene Überarbeitung vorhanden" },
        { status: 400 }
      );
    }

    const updated = await prisma.generatedArticle.update({
      where: { id },
      data: {
        revisionRequestedAt: null,
        revisionRequestedBy: null,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(updated);
  }

  // Content-Update durch Agentur-User (ohne Statuswechsel)
  if (htmlContent !== undefined && !reviewStatus) {
    if (!isAgentur(session.user.role)) {
      return NextResponse.json(
        { error: "Nur Agentur-User können den Inhalt bearbeiten" },
        { status: 403 }
      );
    }

    const plainText = htmlContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;

    const updated = await prisma.generatedArticle.update({
      where: { id },
      data: { htmlContent, wordCount },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(updated);
  }

  // Eloxx-Import-Flag setzen/entfernen
  if (eloxxImported !== undefined && !reviewStatus) {
    if (article.reviewStatus !== "production_ready" && article.reviewStatus !== "published") {
      return NextResponse.json(
        { error: "Eloxx-Import kann nur im Status Production Ready oder Published gesetzt werden" },
        { status: 400 }
      );
    }

    const userName = session.user.name || session.user.email || "Unbekannt";
    const updated = await prisma.generatedArticle.update({
      where: { id },
      data: {
        eloxxImportedAt: eloxxImported ? new Date() : null,
        eloxxImportedBy: eloxxImported ? userName : null,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, name: true, email: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json(updated);
  }

  // Status-Transition
  if (article.revisionRequestedAt) {
    return NextResponse.json(
      { error: "Der Artikel kann nicht weitergereicht werden, solange eine Überarbeitung angefordert ist. Bitte zuerst die Überarbeitung als erledigt markieren." },
      { status: 400 }
    );
  }

  const allowedTransitions = VALID_TRANSITIONS[article.reviewStatus] || [];
  if (!allowedTransitions.includes(reviewStatus)) {
    return NextResponse.json(
      {
        error: `Ungültiger Statuswechsel von "${article.reviewStatus}" zu "${reviewStatus}"`,
      },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    reviewStatus,
    claimedAt: null,
    claimedByUserId: null,
    claimedByName: null,
  };

  if (reviewStatus === "brand_approved") {
    updateData.brandApprovedAt = new Date();
  }
  if (reviewStatus === "compliance_approved") {
    updateData.complianceApprovedAt = new Date();
  }
  if (reviewStatus === "legal_approved") {
    updateData.legalApprovedAt = new Date();
  }

  await prisma.generatedArticle.update({
    where: { id },
    data: updateData,
  });

  const changedByUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { name: true, email: true },
  });
  const changedByName = changedByUser?.name || changedByUser?.email || "Unbekannt";

  await prisma.articleStatusHistory.create({
    data: {
      articleId: id,
      fromStatus: article.reviewStatus,
      toStatus: reviewStatus,
      changedByEmail: session.user.email,
      changedByName,
    },
  });

  const withHistory = await prisma.generatedArticle.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const notifyRole = STATUS_NOTIFY_ROLE[reviewStatus];
  if (notifyRole) {
    try {
      const recipients = await prisma.user.findMany({
        where: { role: notifyRole },
        select: { email: true },
      });

      const baseUrl = process.env.NEXTAUTH_URL || "https://dashboard.tasketeer.com";
      const dashboardUrl = `${baseUrl}/content-check`;

      await Promise.allSettled(
        recipients.map((recipient) =>
          sendContentReviewNotification({
            to: recipient.email,
            articleTitle: article.title,
            newStatus: reviewStatus,
            changedByName,
            dashboardUrl,
          })
        )
      );
    } catch (emailError) {
      console.error("Error sending content review notifications:", emailError);
    }
  }

  return NextResponse.json(withHistory);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  if (!isAgentur(session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;

  const article = await prisma.generatedArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  }

  // Reset editorial plan entry: remove content badge and revert status to "planned"
  await prisma.editorialPlanEntry.updateMany({
    where: { articleId: id },
    data: { contentPushed: false, contentPushedAt: null, status: "planned" },
  });

  await prisma.articleStatusHistory.deleteMany({ where: { articleId: id } });
  await prisma.contentComment.deleteMany({ where: { articleId: id } });
  await prisma.generatedArticle.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
