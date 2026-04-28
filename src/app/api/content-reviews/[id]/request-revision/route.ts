import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { sendRevisionRequestNotification } from "@/lib/resend";
import { createNotificationsForUsers } from "@/lib/notifications";

export async function POST(
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
      comments: true,
    },
  });

  if (!article) {
    return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
  }

  if (article.reviewStatus === "draft" || article.reviewStatus === "published") {
    return NextResponse.json(
      { error: "Überarbeitung kann in diesem Status nicht angefordert werden" },
      { status: 400 }
    );
  }

  if (article.revisionRequestedAt) {
    return NextResponse.json(
      { error: "Es wurde bereits eine Überarbeitung angefordert" },
      { status: 400 }
    );
  }

  const unresolvedComments = article.comments.filter((c) => !c.resolved);
  if (unresolvedComments.length === 0) {
    return NextResponse.json(
      { error: "Es gibt keine offenen Kommentare" },
      { status: 400 }
    );
  }

  const requestedByUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { name: true, email: true },
  });
  const requestedByName = requestedByUser?.name || requestedByUser?.email || "Unbekannt";

  await prisma.generatedArticle.update({
    where: { id },
    data: {
      revisionRequestedAt: new Date(),
      revisionRequestedBy: requestedByName,
    },
  });

  await prisma.articleStatusHistory.create({
    data: {
      articleId: id,
      fromStatus: article.reviewStatus,
      toStatus: article.reviewStatus,
      changedByEmail: session.user.email,
      changedByName: requestedByName,
      comment: "revision_requested",
    },
  });

  const recipients = await prisma.user.findMany({
    where: { role: "agentur" },
    select: { email: true },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "https://dashboard.tasketeer.com";
  const dashboardUrl = `${baseUrl}/content-check?article=${id}`;

  await Promise.allSettled(
    recipients.map((recipient) =>
      sendRevisionRequestNotification({
        to: recipient.email,
        articleTitle: article.title,
        currentStatus: article.reviewStatus,
        requestedByName,
        unresolvedCount: unresolvedComments.length,
        dashboardUrl,
      })
    )
  );

  const recipientsFull = await prisma.user.findMany({
    where: { role: "agentur" },
    select: { id: true },
  });
  await createNotificationsForUsers({
    userIds: recipientsFull.map((u) => u.id),
    type: "revision_request",
    title: "Überarbeitung angefordert",
    message: `${requestedByName} hat eine Überarbeitung für "${article.title}" angefordert. ${unresolvedComments.length} offene Kommentare.`,
    link: `/content-check?article=${id}`,
  });

  return NextResponse.json({ success: true });
}
