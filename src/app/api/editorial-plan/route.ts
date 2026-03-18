import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { sendEditorialPlanStatusNotification } from "@/lib/resend";
import { createNotification } from "@/lib/notifications";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await prisma.editorialPlanEntry.findMany({
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
        article: {
          select: { id: true, reviewStatus: true, title: true, wordCount: true, createdAt: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const transformed = entries.map((entry) => ({
      ...entry,
      assignees: entry.assignees.map((a) => a.user),
    }));

    return NextResponse.json({ entries: transformed });
  } catch (error) {
    console.error("Error fetching editorial plan entries:", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }
}

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
    const { title, description, url, category, ratgeberCategory, funnel, dueDate, assigneeIds } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Titel ist erforderlich" }, { status: 400 });
    }

    if (!dueDate) {
      return NextResponse.json({ error: "Fertigstellungsdatum ist erforderlich" }, { status: 400 });
    }

    const entry = await prisma.editorialPlanEntry.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        url: url?.trim() || null,
        category: category || null,
        ratgeberCategory: ratgeberCategory || null,
        funnel: funnel || null,
        status: "planned",
        dueDate: new Date(dueDate),
        creatorId: session.user.id,
        assignees: assigneeIds?.length
          ? {
              create: assigneeIds.map((userId: string) => ({ userId })),
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
        files: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const transformed = {
      ...entry,
      assignees: entry.assignees.map((a) => a.user),
    };

    if (assigneeIds?.length > 0) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
        const dashboardUrl = `${baseUrl}/redaktionsplan`;
        const creatorName = session.user.name || session.user.email || "Unbekannt";

        for (const assignee of entry.assignees) {
          if (assignee.user.email) {
            await sendEditorialPlanStatusNotification({
              to: assignee.user.email,
              entryTitle: entry.title,
              oldStatus: null,
              newStatus: "planned",
              updaterName: creatorName,
              dueDate: entry.dueDate.toISOString(),
              dashboardUrl,
            });
            await createNotification({
              userId: assignee.userId,
              type: "editorial_plan",
              title: "Redaktionsplan: Neuer Eintrag",
              message: `${creatorName} hat dir den Eintrag "${entry.title}" zugewiesen.`,
              link: "/redaktionsplan",
            });
          }
        }
      } catch (emailError) {
        console.error("Error sending editorial plan notification:", emailError);
      }
    }

    return NextResponse.json({ entry: transformed }, { status: 201 });
  } catch (error) {
    console.error("Error creating editorial plan entry:", error);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }
}
