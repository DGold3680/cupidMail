import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@mymail/database";
import { getAttachmentDownloadUrl } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

/**
 * GET /api/attachments/[id]
 * Generates a Cloudinary URL and redirects to download the attachment.
 */
export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const { id } = resolvedParams;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    try {
      const downloadUrl = getAttachmentDownloadUrl(
        attachment.storageKey,
        attachment.filename
      );
      return NextResponse.redirect(downloadUrl);
    } catch (storageError: any) {
      console.error("Cloudinary download URL generation error:", storageError);
      return NextResponse.json(
        {
          error: "Storage error generating attachment download link",
          details: storageError?.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error processing attachment request:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 }
    );
  }
}
