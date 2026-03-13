import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFullAdminRights } from "@/lib/rbac";

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
    const existing = await prisma.absence.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Abwesenheit nicht gefunden" }, { status: 404 });
    }

    if (existing.userId !== session.user.id && !hasFullAdminRights(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const { type, startDate, endDate, note } = body;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ error: "Startdatum muss vor dem Enddatum liegen" }, { status: 400 });
    }

    const absence = await prisma.absence.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(note !== undefined && { note: note?.trim() || null }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ absence });
  } catch (error) {
    console.error("Error updating absence:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren der Abwesenheit" }, { status: 500 });
  }
}

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
    const existing = await prisma.absence.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Abwesenheit nicht gefunden" }, { status: 404 });
    }

    if (existing.userId !== session.user.id && !hasFullAdminRights(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    await prisma.absence.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting absence:", error);
    return NextResponse.json({ error: "Fehler beim Löschen der Abwesenheit" }, { status: 500 });
  }
}
