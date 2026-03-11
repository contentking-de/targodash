import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFullAdminRights } from "@/lib/rbac";
import { sendWelcomeEmail } from "@/lib/resend";

// GET /api/admin/users - Alle User abrufen (nur Superadmin)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    if (!hasFullAdminRights(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Nutzer" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Neuen User anlegen (nur Superadmin)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    if (!hasFullAdminRights(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, role } = body;

    if (!email) {
      return NextResponse.json(
        { error: "E-Mail ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfen ob User bereits existiert
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Ein Nutzer mit dieser E-Mail existiert bereits" },
        { status: 400 }
      );
    }

    // Validiere Rolle
    const validRoles = ["superadmin", "compliance", "legal", "dev", "member", "viewer"];
    const userRole = validRoles.includes(role) ? role : "member";

    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        role: userRole,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Hole Informationen über den einladenden Superadmin
    const invitingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
      },
    });

    // Versende Willkommens-E-Mail
    try {
      const loginUrl = process.env.NEXTAUTH_URL 
        ? `${process.env.NEXTAUTH_URL}/login`
        : "https://dashboard.tasketeer.com/login";
      
      await sendWelcomeEmail({
        to: email,
        invitedBy: {
          name: invitingUser?.name || null,
          email: invitingUser?.email || "ein Administrator",
        },
        loginUrl,
      });
    } catch (emailError) {
      // Logge Fehler, aber verhindere nicht die User-Erstellung
      console.error("Error sending welcome email:", emailError);
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Nutzers" },
      { status: 500 }
    );
  }
}
