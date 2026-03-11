import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { sendContentReviewNotification } from "@/lib/resend";
import { isAgentur } from "@/lib/rbac";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["compliance_review"],
  compliance_review: ["compliance_approved", "draft"],
  compliance_approved: ["legal_review"],
  legal_review: ["legal_approved", "compliance_approved"],
  legal_approved: ["production_ready"],
  production_ready: ["published"],
  published: [],
};

// Welche Rolle bei welchem neuen Status benachrichtigt wird
const STATUS_NOTIFY_ROLE: Record<string, string> = {
  compliance_review: "compliance",
  legal_review: "legal",
  production_ready: "dev",
  draft: "agentur",
  compliance_approved: "agentur",
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
  const { reviewStatus, htmlContent } = body;

  const article = await prisma.generatedArticle.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  }

  // Content-Update im Draft-Status (ohne Statuswechsel)
  if (htmlContent !== undefined && !reviewStatus) {
    if (article.reviewStatus !== "draft") {
      return NextResponse.json(
        { error: "Inhalt kann nur im Entwurf-Status bearbeitet werden" },
        { status: 400 }
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

  // Status-Transition
  const allowedTransitions = VALID_TRANSITIONS[article.reviewStatus] || [];
  if (!allowedTransitions.includes(reviewStatus)) {
    return NextResponse.json(
      {
        error: `Ungültiger Statuswechsel von "${article.reviewStatus}" zu "${reviewStatus}"`,
      },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { reviewStatus };

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

  await prisma.articleStatusHistory.deleteMany({ where: { articleId: id } });
  await prisma.contentComment.deleteMany({ where: { articleId: id } });
  await prisma.generatedArticle.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
