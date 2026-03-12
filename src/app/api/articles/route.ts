import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isAgentur } from "@/lib/rbac";
import { sendNewContentNotification } from "@/lib/resend";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if (!isAgentur(session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const articles = await prisma.generatedArticle.findMany({
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(articles);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if (!isAgentur(session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const body = await request.json();
  const { title, funnelStage, category, targetAudience, htmlContent, editorialPlanEntryId } = body;

  if (!title || !funnelStage || !category || !targetAudience || !htmlContent) {
    return NextResponse.json(
      { error: "Alle Felder sind erforderlich" },
      { status: 400 }
    );
  }

  let slug = slugify(title);
  const existing = await prisma.generatedArticle.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const article = await prisma.generatedArticle.create({
    data: {
      title,
      slug,
      funnelStage,
      category,
      targetAudience,
      htmlContent,
      wordCount: countWords(htmlContent),
      creatorId: user.id,
    },
    include: { creator: { select: { id: true, name: true, email: true } } },
  });

  if (editorialPlanEntryId) {
    await prisma.editorialPlanEntry.update({
      where: { id: editorialPlanEntryId },
      data: { articleId: article.id },
    }).catch(() => {});
  }

  // Notify all ProduktManagement users about new content
  try {
    const pmUsers = await prisma.user.findMany({
      where: { role: { in: ["produktmanagement", "brand"] } },
      select: { email: true },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "https://dashboard.tasketeer.com";
    const dashboardUrl = `${baseUrl}/content-check`;
    const creatorName = user.name || user.email;

    await Promise.allSettled(
      pmUsers.map((pmUser) =>
        sendNewContentNotification({
          to: pmUser.email,
          articleTitle: title,
          category,
          funnelStage,
          creatorName,
          dashboardUrl,
        })
      )
    );
  } catch (emailError) {
    console.error("Error sending ProduktManagement notifications:", emailError);
  }

  return NextResponse.json(article, { status: 201 });
}
