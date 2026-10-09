import { NextRequest, NextResponse } from "next/server";
import { prisma, MailFolder } from "@mymail/database";

export const dynamic = "force-dynamic";

/**
 * POST /api/emails/messages/[id]/actions
 * Executes mailbox message state changes: star, read/unread, archive, trash, folder moves
 */
export async function POST(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const { id } = resolvedParams;
    const body = await req.json();
    const { action, value, mailboxId } = body;

    const whereClause: any = { messageId: id };
    if (mailboxId) {
      whereClause.mailboxId = mailboxId;
    }

    let updateData: any = {};

    switch (action) {
      case "toggleStar":
        if (typeof value === "boolean") {
          updateData.isStarred = value;
        } else {
          // Toggle current value
          const current = await prisma.mailboxMessage.findFirst({
            where: whereClause,
            select: { isStarred: true },
          });
          updateData.isStarred = !current?.isStarred;
        }
        break;

      case "toggleRead":
        if (typeof value === "boolean") {
          updateData.isRead = value;
        } else {
          const current = await prisma.mailboxMessage.findFirst({
            where: whereClause,
            select: { isRead: true },
          });
          updateData.isRead = !current?.isRead;
        }
        break;

      case "archive":
        updateData.isArchived = true;
        updateData.isDeleted = false;
        break;

      case "trash":
        updateData.isDeleted = true;
        updateData.isArchived = false;
        break;

      case "restore":
        updateData.isDeleted = false;
        updateData.isArchived = false;
        updateData.folder = MailFolder.INBOX;
        break;

      case "moveToFolder":
        if (value && Object.values(MailFolder).includes(value)) {
          updateData.folder = value;
          updateData.isDeleted = false;
          updateData.isArchived = false;
        }
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const result = await prisma.mailboxMessage.updateMany({
      where: whereClause,
      data: updateData,
    });

    return NextResponse.json({ success: true, count: result.count, updateData });
  } catch (error: any) {
    console.error("Action error:", error);
    return NextResponse.json(
      { error: "Failed to execute action", details: error?.message },
      { status: 500 }
    );
  }
}
