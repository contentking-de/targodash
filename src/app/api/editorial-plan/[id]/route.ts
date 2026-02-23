import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { sendEditorialPlanStatusNotification } from "@/lib/resend";

const STATUS_LABELS: Record<string, string> = {
  planned: "Geplant",
  in_progress: "In Bearbeitung",
  review: "Review",
  published: "Veröffentlicht",
};

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

    const entry = await prisma.editorialPlanEntry.findUnique({
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
        files: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({
      entry: {
        ...entry,
        assignees: entry.assignees.map((a) => a.user),
      },
    });
  } catch (error) {
    console.error("Error fetching editorial plan entry:", error);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }
}

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
    const { title, description, url, category, status, dueDate, assigneeIds } = body;

    const existingEntry = await prisma.editorialPlanEntry.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignees: {
          select: { userId: true },
        },
      },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
    }

    const oldStatus = existingEntry.status;
    const statusChanged = status !== undefined && status !== oldStatus;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (url !== undefined) updateData.url = url?.trim() || null;
    if (category !== undefined) updateData.category = category || null;
    if (status !== undefined) updateData.status = status;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : undefined;

    if (assigneeIds !== undefined) {
      await prisma.editorialPlanAssignee.deleteMany({
        where: { entryId: id },
      });

      if (assigneeIds.length > 0) {
        await prisma.editorialPlanAssignee.createMany({
          data: assigneeIds.map((userId: string) => ({
            entryId: id,
            userId,
          })),
        });
      }
    }

    const entry = await prisma.editorialPlanEntry.update({
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
        files: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const transformed = {
      ...entry,
      assignees: entry.assignees.map((a) => a.user),
    };

    if (statusChanged) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        const dashboardUrl = `${baseUrl}/redaktionsplan`;
        const updaterName = session.user.name || session.user.email || "Unbekannt";

        const recipientEmails = new Set<string>();

        // Assignees benachrichtigen
        for (const assignee of entry.assignees) {
          if (assignee.user.email && assignee.userId !== session.user.id) {
            recipientEmails.add(assignee.user.email);
          }
        }

        // Creator benachrichtigen (falls nicht der aktuelle User)
        if (existingEntry.creator.email && existingEntry.creatorId !== session.user.id) {
          recipientEmails.add(existingEntry.creator.email);
        }

        for (const email of recipientEmails) {
          await sendEditorialPlanStatusNotification({
            to: email,
            entryTitle: entry.title,
            oldStatus: STATUS_LABELS[oldStatus] || oldStatus,
            newStatus: STATUS_LABELS[status] || status,
            updaterName,
            dueDate: entry.dueDate.toISOString(),
            dashboardUrl,
          });
        }
      } catch (emailError) {
        console.error("Error sending editorial plan status notification:", emailError);
      }
    }

    return NextResponse.json({ entry: transformed });
  } catch (error) {
    console.error("Error updating editorial plan entry:", error);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}

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

    const entry = await prisma.editorialPlanEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
    }

    await prisma.editorialPlanEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting editorial plan entry:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
