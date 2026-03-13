import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { sendTaskCommentNotification, sendTaskMentionNotification } from "@/lib/resend";

// GET - Alle Kommentare eines Tasks abrufen
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

    const comments = await prisma.taskComment.findMany({
      where: { taskId: id },
      include: {
        task: {
          select: { id: true, title: true },
        },
        reactions: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // User-Daten separat laden (da kein direkter Bezug im Schema)
    const userIds = [...new Set([
      ...comments.map((c) => c.userId),
      ...comments.flatMap((c) => c.reactions.map((r) => r.userId)),
    ])];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const commentsWithUsers = comments.map((comment) => ({
      ...comment,
      user: userMap.get(comment.userId) || { id: comment.userId, name: null, email: "Unbekannt" },
      reactions: comment.reactions.map((r) => ({
        ...r,
        user: userMap.get(r.userId) || { id: r.userId, name: null, email: "Unbekannt" },
      })),
    }));

    return NextResponse.json({ comments: commentsWithUsers });
  } catch (error) {
    console.error("Error fetching task comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

// POST - Neuen Kommentar erstellen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: taskId } = await params;
    const body = await request.json();
    const { text, mentionedUserIds } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
    }

    // Prüfen ob Task existiert und Assignees laden
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Kommentar erstellen
    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId: session.user.id,
        text: text.trim(),
      },
    });

    // User-Daten für die Antwort
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    });

    const commentWithUser = {
      ...comment,
      user: user || { id: session.user.id, name: null, email: session.user.email },
    };

    // E-Mail-Benachrichtigung an alle Assignees senden (außer dem Autor)
    const assigneesToNotify = task.assignees.filter(
      (a) => a.user.id !== session.user.id && a.user.email
    );

    const notifiedUserIds = new Set<string>();

    if (assigneesToNotify.length > 0) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        const dashboardUrl = `${baseUrl}/tasks?taskId=${task.id}`;
        const authorName = session.user.name || session.user.email || "Jemand";

        for (const assignee of assigneesToNotify) {
          await sendTaskCommentNotification({
            to: assignee.user.email,
            taskTitle: task.title,
            commentText: text.trim(),
            authorName,
            dashboardUrl,
          });
          notifiedUserIds.add(assignee.user.id);
        }
      } catch (emailError) {
        console.error("Error sending task comment notification emails:", emailError);
      }
    }

    // E-Mail-Benachrichtigung an erwähnte User senden (die nicht bereits als Assignee benachrichtigt wurden)
    if (mentionedUserIds?.length > 0) {
      try {
        const mentionedUsers = await prisma.user.findMany({
          where: {
            id: { in: mentionedUserIds },
            NOT: { id: session.user.id },
          },
          select: { id: true, email: true },
        });

        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        const dashboardUrl = `${baseUrl}/tasks?taskId=${task.id}`;
        const authorName = session.user.name || session.user.email || "Jemand";

        for (const mentionedUser of mentionedUsers) {
          if (notifiedUserIds.has(mentionedUser.id)) continue;
          await sendTaskMentionNotification({
            to: mentionedUser.email,
            taskTitle: task.title,
            commentText: text.trim(),
            authorName,
            dashboardUrl,
          });
        }
      } catch (emailError) {
        console.error("Error sending task mention notification emails:", emailError);
      }
    }

    return NextResponse.json({ comment: commentWithUser }, { status: 201 });
  } catch (error) {
    console.error("Error creating task comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
