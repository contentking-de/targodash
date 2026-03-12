import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const comments = await prisma.contentComment.findMany({
    where: { articleId: id },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json();
  const { selectedText, commentText, role } = body;

  if (!selectedText || !commentText || !role) {
    return NextResponse.json(
      { error: "selectedText, commentText und role sind erforderlich" },
      { status: 400 }
    );
  }

  if (!["compliance", "legal", "produktmanagement", "brand"].includes(role)) {
    return NextResponse.json(
      { error: "role muss 'compliance', 'legal', 'produktmanagement' oder 'brand' sein" },
      { status: 400 }
    );
  }

  const comment = await prisma.contentComment.create({
    data: {
      articleId: id,
      authorId: user.id,
      selectedText,
      commentText,
      role,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get("commentId");

  if (!commentId) {
    return NextResponse.json({ error: "commentId ist erforderlich" }, { status: 400 });
  }

  await prisma.contentComment.delete({ where: { id: commentId } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await request.json();
  const { commentId, resolved } = body;

  if (!commentId || typeof resolved !== "boolean") {
    return NextResponse.json(
      { error: "commentId und resolved sind erforderlich" },
      { status: 400 }
    );
  }

  const comment = await prisma.contentComment.update({
    where: { id: commentId },
    data: { resolved },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(comment);
}
