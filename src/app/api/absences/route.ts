import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    let whereClause = {};
    if (year && month) {
      const startOfMonth = new Date(parseInt(year), parseInt(month), 1);
      const endOfMonth = new Date(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59);
      whereClause = {
        OR: [
          { startDate: { lte: endOfMonth }, endDate: { gte: startOfMonth } },
        ],
      };
    }

    const absences = await prisma.absence.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ absences });
  } catch (error) {
    console.error("Error fetching absences:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Abwesenheiten" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const body = await request.json();
    const { type, startDate, endDate, note } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start- und Enddatum sind erforderlich" }, { status: 400 });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ error: "Startdatum muss vor dem Enddatum liegen" }, { status: 400 });
    }

    const absence = await prisma.absence.create({
      data: {
        userId: session.user.id,
        type: type || "urlaub",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        note: note?.trim() || null,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json({ absence }, { status: 201 });
  } catch (error) {
    console.error("Error creating absence:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen der Abwesenheit" }, { status: 500 });
  }
}
