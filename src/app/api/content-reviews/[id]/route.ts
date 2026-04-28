import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { sendContentReviewNotification, sendRecheckReadyNotification } from "@/lib/resend";
import { isAgentur, canEditContentRole } from "@/lib/rbac";
import { createNotificationsForUsers } from "@/lib/notifications";
import { del } from "@vercel/blob";
import { computeReviewStepDueAt } from "@/lib/review-deadline";

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

// Welche Rollen bei welchem neuen Status per Mail / In-App benachrichtigt werden
const STATUS_NOTIFY_ROLES: Record<string, string[]> = {
  pm_review: ["produktmanagement"],
  brand_review: ["brand"],
  compliance_review: ["compliance"],
  legal_review: ["legal"],
  production_ready: ["dev", "member", "superadmin"],
};

// Welche Rolle für den aktuellen Review-Step zuständig ist (inkl. _approved Zustände)
const STATUS_RESPONSIBLE_ROLE: Record<string, string> = {
  pm_review: "produktmanagement",
  brand_review: "brand",
  brand_approved: "brand",
  compliance_review: "compliance",
  compliance_approved: "compliance",
  legal_review: "legal",
  legal_approved: "legal",
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
      images: {
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
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
  const { reviewStatus, htmlContent, metaTitle, metaDescription, eloxxImported, resolveRevision, claim } = body;

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

    const recheckComments = await prisma.contentComment.findMany({
      where: { articleId: id, recheckAfterRevision: true },
    });

    const resolvedByUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { name: true, email: true },
    });
    const resolvedByName = resolvedByUser?.name || resolvedByUser?.email || "Unbekannt";

    const revisionRequester = article.revisionRequestedBy || "Unbekannt";

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

    await prisma.articleStatusHistory.create({
      data: {
        articleId: id,
        fromStatus: article.reviewStatus,
        toStatus: article.reviewStatus,
        changedByEmail: session.user.email,
        changedByName: resolvedByName,
        comment: "revision_resolved",
      },
    });

    if (recheckComments.length === 0) {
      await prisma.articleStatusHistory.create({
        data: {
          articleId: id,
          fromStatus: article.reviewStatus,
          toStatus: article.reviewStatus,
          changedByEmail: "system",
          changedByName: revisionRequester,
          comment: "implicit_approval",
        },
      });
    }

    if (recheckComments.length > 0) {
      const responsibleRole = STATUS_RESPONSIBLE_ROLE[article.reviewStatus];
      const notifyUsers = responsibleRole
        ? await prisma.user.findMany({
            where: { role: responsibleRole },
            select: { email: true },
          })
        : [];

      const baseUrl = process.env.NEXTAUTH_URL || "https://dashboard.tasketeer.com";
      const dashboardUrl = `${baseUrl}/content-check?article=${id}`;

      await Promise.allSettled(
        notifyUsers.map((user) =>
          sendRecheckReadyNotification({
            to: user.email,
            articleTitle: article.title,
            resolvedByName,
            recheckCommentCount: recheckComments.length,
            dashboardUrl,
          })
        )
      );

      const notifyUsersFull = responsibleRole
        ? await prisma.user.findMany({
            where: { role: responsibleRole },
            select: { id: true },
          })
        : [];
      await createNotificationsForUsers({
        userIds: notifyUsersFull.map((u) => u.id),
        type: "recheck_ready",
        title: "Überarbeitung abgeschlossen",
        message: `${resolvedByName} hat die Überarbeitung für "${article.title}" abgeschlossen. ${recheckComments.length} Recheck-Kommentare warten.`,
        link: `/content-check?article=${id}`,
      });
    }

    const refreshed = await prisma.generatedArticle.findUnique({
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

    return NextResponse.json(refreshed);
  }

  // Content-Update durch Agentur- oder ProduktManagement-User (ohne Statuswechsel)
  if ((htmlContent !== undefined || metaTitle !== undefined || metaDescription !== undefined) && !reviewStatus) {
    if (!canEditContentRole(session.user.role)) {
      return NextResponse.json(
        { error: "Nur Agentur- und ProduktManagement-User können den Inhalt bearbeiten" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};

    if (htmlContent !== undefined) {
      const plainText = htmlContent.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      data.htmlContent = htmlContent;
      data.wordCount = plainText ? plainText.split(/\s+/).length : 0;
    }

    if (metaTitle !== undefined) {
      data.metaTitle = metaTitle || null;
    }

    if (metaDescription !== undefined) {
      data.metaDescription = metaDescription || null;
    }

    const updated = await prisma.generatedArticle.update({
      where: { id },
      data,
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

  if (reviewStatus === "published") {
    updateData.reviewStepDueAt = null;
  } else {
    updateData.reviewStepDueAt = computeReviewStepDueAt(new Date());
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

  const notifyRoles = STATUS_NOTIFY_ROLES[reviewStatus];
  if (notifyRoles?.length) {
    try {
      const recipients = await prisma.user.findMany({
        where: { role: { in: notifyRoles } },
        select: { email: true },
      });

      const baseUrl = process.env.NEXTAUTH_URL || "https://dashboard.tasketeer.com";
      const dashboardUrl = `${baseUrl}/content-check?article=${id}`;

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

      const recipientsFull = await prisma.user.findMany({
        where: { role: { in: notifyRoles } },
        select: { id: true },
      });
      await createNotificationsForUsers({
        userIds: recipientsFull.map((u) => u.id),
        type: "content_review",
        title: "Content-Review",
        message: `${changedByName} hat "${article.title}" in den Review-Status überführt. Bitte prüfen.`,
        link: `/content-check?article=${id}`,
      });
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

  // Delete article images from Vercel Blob
  const articleImages = await prisma.articleImage.findMany({ where: { articleId: id } });
  await Promise.allSettled(articleImages.map((img) => del(img.fileUrl)));
  await prisma.articleImage.deleteMany({ where: { articleId: id } });

  await prisma.articleStatusHistory.deleteMany({ where: { articleId: id } });
  await prisma.contentComment.deleteMany({ where: { articleId: id } });
  await prisma.generatedArticle.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
