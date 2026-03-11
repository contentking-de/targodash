import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isAgentur } from "@/lib/rbac";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if (!isAgentur(session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;

  const entry = await prisma.editorialPlanEntry.findUnique({
    where: { id },
  });

  if (!entry) {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  await prisma.editorialPlanEntry.update({
    where: { id },
    data: {
      contentPushed: true,
      contentPushedAt: new Date(),
      status: entry.status === "planned" ? "in_progress" : entry.status,
    },
  });

  return NextResponse.json({
    success: true,
    entry: {
      id: entry.id,
      title: entry.title,
      ratgeberCategory: entry.ratgeberCategory,
      funnel: entry.funnel,
      description: entry.description,
    },
  });
}
