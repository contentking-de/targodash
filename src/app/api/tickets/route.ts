import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTicketAssignmentNotification } from "@/lib/resend";
import { createNotification } from "@/lib/notifications";

// GET /api/tickets - Alle Tickets abrufen
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const tickets = await prisma.ticket.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            reactions: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    // User-Daten für Kommentare und Reactions laden
    const allCommentUserIds = [...new Set(
      tickets.flatMap((t) => [
        ...t.comments.map((c) => c.userId),
        ...t.comments.flatMap((c) => c.reactions.map((r) => r.userId)),
      ])
    )];
    const commentUsers = allCommentUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: allCommentUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(commentUsers.map((u) => [u.id, u]));

    const ticketsWithCommentUsers = tickets.map((ticket) => ({
      ...ticket,
      comments: ticket.comments.map((comment) => ({
        ...comment,
        user: userMap.get(comment.userId) || { id: comment.userId, name: null, email: "Unbekannt" },
        reactions: comment.reactions.map((r) => ({
          ...r,
          user: userMap.get(r.userId) || { id: r.userId, name: null, email: "Unbekannt" },
        })),
      })),
    }));

    return NextResponse.json({ tickets: ticketsWithCommentUsers });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Tickets" },
      { status: 500 }
    );
  }
}

// POST /api/tickets - Neues Ticket erstellen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, type, priority, assigneeIds } = body;

    if (!title || !description || !type) {
      return NextResponse.json(
        { error: "Titel, Beschreibung und Typ sind erforderlich" },
        { status: 400 }
      );
    }

    if (!["bug", "feature"].includes(type)) {
      return NextResponse.json(
        { error: "Typ muss 'bug' oder 'feature' sein" },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.create({
      data: {
        userId: session.user.id,
        title,
        description,
        type,
        priority: priority || "medium",
        status: "open",
        ...(assigneeIds && assigneeIds.length > 0 && {
          assignees: {
            create: assigneeIds.map((userId: string) => ({
              userId,
            })),
          },
        }),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // E-Mail-Benachrichtigungen an Assignees senden (async, nicht blockierend)
    if (assigneeIds && assigneeIds.length > 0) {
      const dashboardUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/tickets`;
      const creatorName = session.user.name || session.user.email || "Jemand";

      // Nur an andere User senden, nicht an den Ersteller selbst
      const assigneesToNotify = ticket.assignees.filter(
        (a) => a.user.id !== session.user!.id
      );

      for (const assignee of assigneesToNotify) {
        try {
          await sendTicketAssignmentNotification({
            to: assignee.user.email,
            ticketTitle: title,
            ticketType: type,
            priority: priority || "medium",
            creatorName,
            dashboardUrl,
          });
          await createNotification({
            userId: assignee.user.id,
            type: "ticket_assigned",
            title: "Ticket zugewiesen",
            message: `${creatorName} hat dir das Ticket "${title}" zugewiesen.`,
            link: "/tickets",
          });
        } catch (emailError) {
          console.error(`Failed to send ticket assignment email to ${assignee.user.email}:`, emailError);
        }
      }
    }

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Tickets" },
      { status: 500 }
    );
  }
}
