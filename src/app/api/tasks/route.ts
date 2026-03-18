import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { sendTaskAssignmentNotification } from "@/lib/resend";
import { createNotification } from "@/lib/notifications";

// GET - Alle Tasks abrufen
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
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
          orderBy: { createdAt: "desc" },
        },
        files: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [
        { status: "asc" },
        { order: "asc" },
        { createdAt: "desc" },
      ],
    });

    // User-Daten für Kommentar-Autoren laden
    const allCommentUserIds = [
      ...new Set(tasks.flatMap((t) => t.comments.map((c) => c.userId))),
    ];
    const commentUsers =
      allCommentUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: allCommentUserIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const commentUserMap = new Map(commentUsers.map((u) => [u.id, u]));

    // Transform assignees & comments for frontend
    const transformedTasks = tasks.map((task) => ({
      ...task,
      assignees: task.assignees.map((a) => a.user),
      comments: task.comments.map((comment) => ({
        ...comment,
        user: commentUserMap.get(comment.userId) ?? {
          id: comment.userId,
          name: null,
          email: null,
        },
      })),
    }));

    return NextResponse.json({ tasks: transformedTasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// POST - Neuen Task erstellen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, status, priority, dueDate, category, labels, assigneeIds } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Höchste Order in der Spalte finden
    const maxOrderTask = await prisma.task.findFirst({
      where: { status: status || "backlog" },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        status: status || "backlog",
        priority: priority || "medium",
        order: (maxOrderTask?.order ?? -1) + 1,
        dueDate: dueDate ? new Date(dueDate) : null,
        category: category || null,
        labels: labels || [],
        creatorId: session.user.id,
        assignees: assigneeIds?.length
          ? {
              create: assigneeIds.map((userId: string) => ({
                userId,
              })),
            }
          : undefined,
      },
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
        comments: true,
        files: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Transform for frontend
    const transformedTask = {
      ...task,
      assignees: task.assignees.map((a) => a.user),
    };

    // E-Mail-Benachrichtigung an alle Assignees senden
    if (assigneeIds?.length > 0) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        const dashboardUrl = `${baseUrl}/tasks?taskId=${task.id}`;
        const creatorName = session.user.name || session.user.email || "Unbekannt";

        for (const assignee of task.assignees) {
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
        // E-Mail-Fehler loggen, aber Task-Erstellung nicht abbrechen
        console.error("Error sending task assignment notification emails:", emailError);
      }
    }

    return NextResponse.json({ task: transformedTask });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

// PATCH - Tasks neu ordnen (für Drag & Drop)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { taskId, newStatus, newOrder } = body;

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Hole den aktuellen Task
    const currentTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const oldStatus = currentTask.status;
    const oldOrder = currentTask.order;
    const targetStatus = newStatus || oldStatus;

    // Wenn Status sich ändert oder Task innerhalb derselben Spalte bewegt wird
    if (oldStatus !== targetStatus) {
      // Task wechselt die Spalte
      // 1. Lücke in alter Spalte schließen
      await prisma.task.updateMany({
        where: {
          status: oldStatus,
          order: { gt: oldOrder },
        },
        data: {
          order: { decrement: 1 },
        },
      });

      // 2. Platz in neuer Spalte machen
      await prisma.task.updateMany({
        where: {
          status: targetStatus,
          order: { gte: newOrder },
        },
        data: {
          order: { increment: 1 },
        },
      });

      // 3. Task updaten
      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          status: targetStatus,
          order: newOrder,
        },
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
          comments: true,
        },
      });

      const transformedTask = {
        ...updatedTask,
        assignees: updatedTask.assignees.map((a) => a.user),
      };

      return NextResponse.json({ task: transformedTask });
    } else {
      // Task bleibt in derselben Spalte, nur Reihenfolge ändert sich
      if (newOrder > oldOrder) {
        // Nach unten bewegen
        await prisma.task.updateMany({
          where: {
            status: targetStatus,
            order: { gt: oldOrder, lte: newOrder },
          },
          data: {
            order: { decrement: 1 },
          },
        });
      } else if (newOrder < oldOrder) {
        // Nach oben bewegen
        await prisma.task.updateMany({
          where: {
            status: targetStatus,
            order: { gte: newOrder, lt: oldOrder },
          },
          data: {
            order: { increment: 1 },
          },
        });
      }

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: { order: newOrder },
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
          comments: true,
        },
      });

      const transformedTask = {
        ...updatedTask,
        assignees: updatedTask.assignees.map((a) => a.user),
      };

      return NextResponse.json({ task: transformedTask });
    }
  } catch (error) {
    console.error("Error reordering task:", error);
    return NextResponse.json({ error: "Failed to reorder task" }, { status: 500 });
  }
}
