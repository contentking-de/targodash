import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { canEdit } from "@/lib/rbac";

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

    const files = await prisma.editorialPlanFile.findMany({
      where: { entryId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching editorial plan files:", error);
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
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

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;

    const entry = await prisma.editorialPlanEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Keine Dateien ausgewählt" }, { status: 400 });
    }

    if (files.length > 10) {
      return NextResponse.json({ error: "Maximal 10 Dateien gleichzeitig" }, { status: 400 });
    }

    const ALLOWED_TYPES = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ];
    const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

    const uploadedFiles = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) continue;

      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) continue;

      const blob = await put(`editorial-plan/${id}/${file.name}`, file, {
        access: "public",
        addRandomSuffix: true,
      });

      const epFile = await prisma.editorialPlanFile.create({
        data: {
          entryId: id,
          fileName: file.name,
          fileUrl: blob.url,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
        },
      });

      uploadedFiles.push(epFile);
    }

    return NextResponse.json({ files: uploadedFiles });
  } catch (error) {
    console.error("Error uploading editorial plan files:", error);
    return NextResponse.json({ error: "Failed to upload files" }, { status: 500 });
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

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "fileId ist erforderlich" }, { status: 400 });
    }

    const file = await prisma.editorialPlanFile.findFirst({
      where: { id: fileId, entryId: id },
    });

    if (!file) {
      return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
    }

    try {
      await del(file.fileUrl);
    } catch (error) {
      console.error("Error deleting from Vercel Blob:", error);
    }

    await prisma.editorialPlanFile.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting editorial plan file:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
