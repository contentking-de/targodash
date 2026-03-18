import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { sendTaskAssignmentNotification } from "@/lib/resend";
import { createNotification } from "@/lib/notifications";

// GET - Einzelnen Task abrufen
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

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
        files: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // User-Daten für Kommentar-Autoren laden (TaskComment hat keine user-Relation im Schema)
    const commentUserIds = [...new Set(task.comments.map((c) => c.userId))];
    const commentUsers =
      commentUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: commentUserIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const commentUserMap = new Map(commentUsers.map((u) => [u.id, u]));

    const commentsWithUsers = task.comments.map((comment) => ({
      ...comment,
      user: commentUserMap.get(comment.userId) ?? {
        id: comment.userId,
        name: null,
        email: null,
      },
    }));

    const transformedTask = {
      ...task,
      assignees: task.assignees.map((a) => a.user),
      comments: commentsWithUsers,
    };

    return NextResponse.json({ task: transformedTask });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

// PATCH - Task aktualisieren
export async function PATCH(
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

    const { id } = await params;
    const body = await request.json();
    const { title, description, status, priority, dueDate, category, labels, assigneeIds } = body;

    // Prüfen ob Task existiert und bestehende Assignees laden
    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        assignees: {
          select: { userId: true },
        },
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Bestehende Assignee-IDs merken für spätere Benachrichtigung
    const existingAssigneeIds = existingTask.assignees.map((a) => a.userId);

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (category !== undefined) updateData.category = category || null;
    if (labels !== undefined) updateData.labels = labels;

    // Handle assignees update
    if (assigneeIds !== undefined) {
      // Delete all existing assignees and create new ones
      await prisma.taskAssignee.deleteMany({
        where: { taskId: id },
      });

      if (assigneeIds.length > 0) {
        await prisma.taskAssignee.createMany({
          data: assigneeIds.map((userId: string) => ({
            taskId: id,
            userId,
          })),
        });
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
        files: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // User-Daten für Kommentar-Autoren anreichern
    const commentUserIds = [...new Set(task.comments.map((c) => c.userId))];
    const commentUsers =
      commentUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: commentUserIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const commentUserMap = new Map(commentUsers.map((u) => [u.id, u]));
    const commentsWithUsers = task.comments.map((comment) => ({
      ...comment,
      user: commentUserMap.get(comment.userId) ?? {
        id: comment.userId,
        name: null,
        email: null,
      },
    }));

    const transformedTask = {
      ...task,
      assignees: task.assignees.map((a) => a.user),
      comments: commentsWithUsers,
    };

    // E-Mail-Benachrichtigung an NEUE Assignees senden
    if (assigneeIds !== undefined) {
      const newAssigneeIds = assigneeIds.filter(
        (userId: string) => !existingAssigneeIds.includes(userId)
      );

      if (newAssigneeIds.length > 0) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
          const dashboardUrl = `${baseUrl}/tasks?taskId=${task.id}`;
          const creatorName = session.user.name || session.user.email || "Unbekannt";

          // Neue Assignees aus den aktualisierten Task-Daten filtern
          const newAssignees = task.assignees.filter((a) =>
            newAssigneeIds.includes(a.userId)
          );

          for (const assignee of newAssignees) {
            if (assignee.user.email) {
              await sendTaskAssignmentNotification({
                to: assignee.user.email,
                taskTitle: task.title,
                taskDescription: task.description,
                creatorName,
                priority: task.priority,
                dueDate: task.dueDate?.toISOString() || null,
                dashboardUrl,
              });
              await createNotification({
                userId: assignee.userId,
                type: "task_assigned",
                title: "Neuer Task zugewiesen",
                message: `${creatorName} hat dir den Task "${task.title}" zugewiesen.`,
                link: `/tasks?taskId=${task.id}`,
              });
            }
          }
        } catch (emailError) {
          // E-Mail-Fehler loggen, aber Task-Update nicht abbrechen
          console.error("Error sending task assignment notification emails:", emailError);
        }
      }
    }

    return NextResponse.json({ task: transformedTask });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// DELETE - Task löschen
export async function DELETE(
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

    const { id } = await params;

    // Prüfen ob Task existiert
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Task löschen
    await prisma.task.delete({
      where: { id },
    });

    // Lücke in der Spalte schließen
    await prisma.task.updateMany({
      where: {
        status: existingTask.status,
        order: { gt: existingTask.order },
      },
      data: {
        order: { decrement: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
