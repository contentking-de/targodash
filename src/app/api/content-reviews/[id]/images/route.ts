import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";

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

    const images = await prisma.articleImage.findMany({
      where: { articleId: id },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Error fetching article images:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "agentur" && session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;

    const article = await prisma.generatedArticle.findUnique({ where: { id } });
    if (!article) {
      return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll("images") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Keine Bilder ausgewählt" }, { status: 400 });
    }

    if (files.length > 5) {
      return NextResponse.json({ error: "Maximal 5 Bilder gleichzeitig" }, { status: 400 });
    }

    const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
    const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    const MAX_SIZE = 10 * 1024 * 1024;

    const uploadedImages = [];

    for (const file of files) {
      if (file.size > MAX_SIZE) continue;

      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) continue;

      const blob = await put(`content-images/${id}/${file.name}`, file, {
        access: "public",
        addRandomSuffix: true,
      });

      const image = await prisma.articleImage.create({
        data: {
          articleId: id,
          fileName: file.name,
          fileUrl: blob.url,
          fileSize: file.size,
          fileType: file.type,
          uploadedById: session.user.id,
        },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      });

      uploadedImages.push(image);
    }

    return NextResponse.json({ images: uploadedImages });
  } catch (error) {
    console.error("Error uploading article images:", error);
    return NextResponse.json({ error: "Failed to upload images" }, { status: 500 });
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

    if (session.user.role !== "agentur" && session.user.role !== "superadmin") {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json({ error: "imageId ist erforderlich" }, { status: 400 });
    }

    const image = await prisma.articleImage.findFirst({
      where: { id: imageId, articleId: id },
    });

    if (!image) {
      return NextResponse.json({ error: "Bild nicht gefunden" }, { status: 404 });
    }

    try {
      await del(image.fileUrl);
    } catch (error) {
      console.error("Error deleting from Vercel Blob:", error);
    }

    await prisma.articleImage.delete({ where: { id: imageId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting article image:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
