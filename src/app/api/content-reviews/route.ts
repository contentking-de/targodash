import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const articles = await prisma.generatedArticle.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          comments: true,
        },
      },
    },
  });

  const articlesWithCommentCounts = await Promise.all(
    articles.map(async (article) => {
      const unresolvedCount = await prisma.contentComment.count({
        where: { articleId: article.id, resolved: false },
      });
      return {
        ...article,
        _count: {
          ...article._count,
          unresolvedComments: unresolvedCount,
          resolvedComments: article._count.comments - unresolvedCount,
        },
      };
    })
  );

  return NextResponse.json(articlesWithCommentCounts);
}
