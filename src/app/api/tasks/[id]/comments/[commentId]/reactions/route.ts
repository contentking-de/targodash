import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST - Toggle Reaction (hinzufügen oder entfernen)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { commentId } = await params;
    const body = await request.json();
    const { emoji } = body;

    if (!emoji?.trim()) {
      return NextResponse.json({ error: "Emoji ist erforderlich" }, { status: 400 });
    }

    const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!comment) {
      return NextResponse.json({ error: "Kommentar nicht gefunden" }, { status: 404 });
    }

    const existing = await prisma.taskCommentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId: session.user.id,
          emoji: emoji.trim(),
        },
      },
    });

    if (existing) {
      await prisma.taskCommentReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.taskCommentReaction.create({
        data: {
          commentId,
          userId: session.user.id,
          emoji: emoji.trim(),
        },
      });
    }

    const reactions = await prisma.taskCommentReaction.findMany({
      where: { commentId },
      orderBy: { createdAt: "asc" },
    });

    const userIds = [...new Set(reactions.map((r) => r.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const reactionsWithUsers = reactions.map((r) => ({
      ...r,
      user: userMap.get(r.userId) || { id: r.userId, name: null, email: "Unbekannt" },
    }));

    return NextResponse.json({
      reactions: reactionsWithUsers,
      toggled: !existing,
    });
  } catch (error) {
    console.error("Error toggling reaction:", error);
    return NextResponse.json({ error: "Fehler beim Reagieren" }, { status: 500 });
  }
}
