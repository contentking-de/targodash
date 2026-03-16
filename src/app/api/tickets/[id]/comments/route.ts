import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTicketUpdateNotification, sendTicketMentionNotification } from "@/lib/resend";

// GET /api/tickets/[id]/comments - Alle Kommentare eines Tickets abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { id } = await params;

    const comments = await prisma.ticketComment.findMany({
      where: { ticketId: id },
      include: {
        reactions: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

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
    console.error("Error fetching ticket comments:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Kommentare" },
      { status: 500 }
    );
  }
}

// POST /api/tickets/[id]/comments - Kommentar hinzufügen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { text, mentionedUserIds } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Kommentartext ist erforderlich" },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        userId: session.user.id,
        text: text.trim(),
      },
    });

    const commentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    });

    const commentWithUser = {
      ...comment,
      user: commentUser || { id: session.user.id, name: null, email: "Unbekannt" },
      reactions: [],
    };

    const dashboardUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/tickets`;
    const authorName = session.user.name || session.user.email || "Jemand";
    const truncatedComment = text.trim().length > 300
      ? text.trim().substring(0, 300) + "..."
      : text.trim();

    const notifiedUserIds = new Set<string>();

    // Assignees benachrichtigen
    for (const assignee of ticket.assignees) {
      if (assignee.user.id !== session.user!.id) {
        try {
          await sendTicketUpdateNotification({
            to: assignee.user.email,
            ticketTitle: ticket.title,
            updateType: "comment",
            updateDetails: truncatedComment,
            updaterName: authorName,
            dashboardUrl,
          });
          notifiedUserIds.add(assignee.user.id);
        } catch (emailError) {
          console.error(`Failed to send ticket comment email to ${assignee.user.email}:`, emailError);
        }
      }
    }

    // Ticket-Ersteller benachrichtigen
    if (ticket.userId !== session.user!.id && !notifiedUserIds.has(ticket.userId)) {
      const creator = await prisma.user.findUnique({
        where: { id: ticket.userId },
        select: { id: true, email: true },
      });
      if (creator) {
        try {
          await sendTicketUpdateNotification({
            to: creator.email,
            ticketTitle: ticket.title,
            updateType: "comment",
            updateDetails: truncatedComment,
            updaterName: authorName,
            dashboardUrl,
          });
          notifiedUserIds.add(creator.id);
        } catch (emailError) {
          console.error(`Failed to send ticket comment email to ${creator.email}:`, emailError);
        }
      }
    }

    // Erwähnte User benachrichtigen (die noch nicht benachrichtigt wurden)
    if (mentionedUserIds?.length > 0) {
      try {
        const mentionedUsers = await prisma.user.findMany({
          where: {
            id: { in: mentionedUserIds },
            NOT: { id: session.user.id },
          },
          select: { id: true, email: true },
        });

        for (const mentionedUser of mentionedUsers) {
          if (notifiedUserIds.has(mentionedUser.id)) continue;
          try {
            await sendTicketMentionNotification({
              to: mentionedUser.email,
              ticketTitle: ticket.title,
              commentText: text.trim(),
              authorName,
              dashboardUrl,
            });
          } catch (emailError) {
            console.error(`Failed to send ticket mention email to ${mentionedUser.email}:`, emailError);
          }
        }
      } catch (emailError) {
        console.error("Error sending ticket mention notification emails:", emailError);
      }
    }

    return NextResponse.json({ comment: commentWithUser }, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Kommentars" },
      { status: 500 }
    );
  }
}
