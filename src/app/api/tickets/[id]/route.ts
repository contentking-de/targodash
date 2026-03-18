import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTicketUpdateNotification, sendTicketAssignmentNotification } from "@/lib/resend";
import { createNotification } from "@/lib/notifications";

const statusLabels: Record<string, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  closed: "Geschlossen",
};

// GET /api/tickets/[id] - Einzelnes Ticket abrufen
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
    const ticket = await prisma.ticket.findUnique({
      where: { id },
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
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }

    // User-Daten für Kommentare und Reactions laden
    const commentUserIds = [...new Set([
      ...ticket.comments.map((c) => c.userId),
      ...ticket.comments.flatMap((c) => c.reactions.map((r) => r.userId)),
    ])];
    const commentUsers = commentUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: commentUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(commentUsers.map((u) => [u.id, u]));

    const ticketWithCommentUsers = {
      ...ticket,
      comments: ticket.comments.map((comment) => ({
        ...comment,
        user: userMap.get(comment.userId) || { id: comment.userId, name: null, email: "Unbekannt" },
        reactions: comment.reactions.map((r) => ({
          ...r,
          user: userMap.get(r.userId) || { id: r.userId, name: null, email: "Unbekannt" },
        })),
      })),
    };

    return NextResponse.json({ ticket: ticketWithCommentUsers });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Tickets" },
      { status: 500 }
    );
  }
}

// PATCH /api/tickets/[id] - Ticket aktualisieren
export async function PATCH(
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
    const { title, description, type, status, priority, assigneeIds } = body;

    // Prüfen ob Ticket existiert
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
      include: {
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
      },
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }

    // Validierung
    if (type && !["bug", "feature"].includes(type)) {
      return NextResponse.json(
        { error: "Typ muss 'bug' oder 'feature' sein" },
        { status: 400 }
      );
    }

    if (status && !["open", "in_progress", "closed"].includes(status)) {
      return NextResponse.json(
        { error: "Status muss 'open', 'in_progress' oder 'closed' sein" },
        { status: 400 }
      );
    }

    if (priority && !["low", "medium", "high"].includes(priority)) {
      return NextResponse.json(
        { error: "Priorität muss 'low', 'medium' oder 'high' sein" },
        { status: 400 }
      );
    }

    // Assignees aktualisieren wenn übergeben
    if (assigneeIds !== undefined) {
      const existingAssigneeIds = existingTicket.assignees.map((a) => a.userId);
      const toAdd = assigneeIds.filter((uid: string) => !existingAssigneeIds.includes(uid));
      const toRemove = existingAssigneeIds.filter((uid: string) => !assigneeIds.includes(uid));

      if (toRemove.length > 0) {
        await prisma.ticketAssignee.deleteMany({
          where: {
            ticketId: id,
            userId: { in: toRemove },
          },
        });
      }

      if (toAdd.length > 0) {
        await prisma.ticketAssignee.createMany({
          data: toAdd.map((userId: string) => ({
            ticketId: id,
            userId,
          })),
        });
      }

      // Benachrichtigung an neu hinzugefügte Assignees
      if (toAdd.length > 0) {
        const dashboardUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/tickets`;
        const creatorName = session.user.name || session.user.email || "Jemand";

        const newAssignees = await prisma.user.findMany({
          where: { id: { in: toAdd } },
          select: { id: true, email: true },
        });

        for (const assignee of newAssignees) {
          if (assignee.id === session.user!.id) continue; // Nicht an sich selbst senden
          try {
            await sendTicketAssignmentNotification({
              to: assignee.email,
              ticketTitle: existingTicket.title,
              ticketType: existingTicket.type,
              priority: existingTicket.priority,
              creatorName,
              dashboardUrl,
            });
            await createNotification({
              userId: assignee.id,
              type: "ticket_assigned",
              title: "Ticket zugewiesen",
              message: `${creatorName} hat dir das Ticket "${existingTicket.title}" zugewiesen.`,
              link: "/tickets",
            });
          } catch (emailError) {
            console.error(`Failed to send ticket assignment email to ${assignee.email}:`, emailError);
          }
        }
      }
    }

    // Ticket-Felder aktualisieren
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(type && { type }),
        ...(status && { status }),
        ...(priority && { priority }),
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
          include: {
            reactions: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    // User-Daten für Kommentare und Reactions
    const patchCommentUserIds = [...new Set([
      ...ticket.comments.map((c) => c.userId),
      ...ticket.comments.flatMap((c) => c.reactions.map((r) => r.userId)),
    ])];
    const patchCommentUsers = patchCommentUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: patchCommentUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const patchUserMap = new Map(patchCommentUsers.map((u) => [u.id, u]));

    const ticketWithCommentUsers = {
      ...ticket,
      comments: ticket.comments.map((comment) => ({
        ...comment,
        user: patchUserMap.get(comment.userId) || { id: comment.userId, name: null, email: "Unbekannt" },
        reactions: comment.reactions.map((r) => ({
          ...r,
          user: patchUserMap.get(r.userId) || { id: r.userId, name: null, email: "Unbekannt" },
        })),
      })),
    };

    // Update-Benachrichtigung an alle Assignees senden (bei Status-/Feld-Änderungen)
    if (status || title || description || type || priority) {
      const dashboardUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/tickets`;
      const updaterName = session.user.name || session.user.email || "Jemand";

      // Bestimme Update-Details
      let updateType = "general";
      let updateDetails = "Das Ticket wurde aktualisiert.";

      if (status && status !== existingTicket.status) {
        updateType = "status";
        const oldLabel = statusLabels[existingTicket.status] || existingTicket.status;
        const newLabel = statusLabels[status] || status;
        updateDetails = `Status geändert: ${oldLabel} → ${newLabel}`;
      }

      // An alle Assignees senden, die nicht der aktuelle User sind
      const assigneesToNotify = ticket.assignees.filter(
        (a) => a.user.id !== session.user!.id
      );

      // Auch den Ticket-Ersteller benachrichtigen, wenn er nicht der Updater ist
      const shouldNotifyCreator = existingTicket.userId !== session.user!.id;
      
      const notifyEmails = new Set<string>();
      for (const a of assigneesToNotify) {
        notifyEmails.add(a.user.email);
      }
      if (shouldNotifyCreator) {
        const creator = await prisma.user.findUnique({
          where: { id: existingTicket.userId },
          select: { email: true },
        });
        if (creator) {
          notifyEmails.add(creator.email);
        }
      }

      for (const email of notifyEmails) {
        try {
          await sendTicketUpdateNotification({
            to: email,
            ticketTitle: ticket.title,
            updateType,
            updateDetails,
            updaterName,
            dashboardUrl,
          });
        } catch (emailError) {
          console.error(`Failed to send ticket update email to ${email}:`, emailError);
        }
      }

      const allNotifyUserIds = [
        ...assigneesToNotify.map((a) => a.user.id),
        ...(shouldNotifyCreator ? [existingTicket.userId] : []),
      ].filter((uid) => uid !== session.user!.id);
      for (const uid of [...new Set(allNotifyUserIds)]) {
        await createNotification({
          userId: uid,
          type: "ticket_update",
          title: `Ticket aktualisiert: ${ticket.title}`,
          message: `${updaterName}: ${updateDetails}`,
          link: "/tickets",
        });
      }
    }

    return NextResponse.json({ ticket: ticketWithCommentUsers });
  } catch (error) {
    console.error("Error updating ticket:");
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Tickets" },
      { status: 500 }
    );
  }
}

// DELETE /api/tickets/[id] - Ticket löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { id } = await params;

    // Prüfen ob Ticket existiert und dem User gehört
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }

    // Nur eigene Tickets löschen (oder Admin)
    if (existingTicket.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Löschen dieses Tickets" },
        { status: 403 }
      );
    }

    await prisma.ticket.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Tickets" },
      { status: 500 }
    );
  }
}
