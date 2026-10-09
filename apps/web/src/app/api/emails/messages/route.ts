import { NextRequest, NextResponse } from "next/server";
import { prisma, MailFolder, Role } from "@mymail/database";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/emails/messages
 * Highly optimized, paginated message listing with folder, search, and mailbox filtering.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const folderParam = (searchParams.get("folder") || "INBOX").toUpperCase();
    const mailboxId = searchParams.get("mailboxId");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
    const skip = (page - 1) * limit;

    // Build the query where clause
    const where: any = {};

    // 1. Mailbox filter
    if (mailboxId && mailboxId !== "all") {
      where.mailboxId = mailboxId;
    } else {
      if (user && user.role !== Role.ADMIN && user.role !== Role.OWNER) {
        where.mailbox = {
          OR: [
            { domain: { ownerId: user.id } },
            { members: { some: { userId: user.id } } },
            { domain: { name: "runnly.xyz" } },
          ],
        };
      }
    }

    // 2. Folder filter & flags
    if (folderParam === "STARRED") {
      where.isStarred = true;
      where.isDeleted = false;
    } else if (folderParam === "TRASH") {
      where.isDeleted = true;
    } else if (folderParam === "ARCHIVE") {
      where.isArchived = true;
      where.isDeleted = false;
    } else if (folderParam === "ALL") {
      where.isDeleted = false;
    } else {
      // Standard folders: INBOX, SENT, DRAFTS, SPAM
      const folderEnum = folderParam as MailFolder;
      if (Object.values(MailFolder).includes(folderEnum)) {
        where.folder = folderEnum;
      } else {
        where.folder = MailFolder.INBOX;
      }
      where.isDeleted = false;
      where.isArchived = false;
    }

    // 3. Search query filter (optimized with contains)
    if (search) {
      where.message = {
        OR: [
          { subject: { contains: search, mode: "insensitive" } },
          { fromAddress: { contains: search, mode: "insensitive" } },
          { fromName: { contains: search, mode: "insensitive" } },
          { textBody: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // 4. Execute optimized query:
    // Only select required card metadata (exclude heavy HTML bodies)
    const [messages, totalCount, unreadCount] = await Promise.all([
      prisma.mailboxMessage.findMany({
        where,
        take: limit,
        skip,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          mailboxId: true,
          folder: true,
          isRead: true,
          isStarred: true,
          isArchived: true,
          isDeleted: true,
          createdAt: true,
          mailbox: {
            select: {
              id: true,
              address: true,
              displayName: true,
            },
          },
          message: {
            select: {
              id: true,
              threadId: true,
              fromAddress: true,
              fromName: true,
              subject: true,
              direction: true,
              sentAt: true,
              receivedAt: true,
              thread: {
                select: {
                  id: true,
                  snippet: true,
                  messageCount: true,
                },
              },
              attachments: {
                select: {
                  id: true,
                  filename: true,
                  sizeBytes: true,
                  contentType: true,
                },
              },
            },
          },
        },
      }),
      prisma.mailboxMessage.count({ where }),
      prisma.mailboxMessage.count({
        where: {
          ...where,
          isRead: false,
        },
      }),
    ]);

    // Format for clean consumption in the frontend
    const items = messages.map((m) => ({
      id: m.message.id,
      mailboxMessageId: m.id,
      mailboxId: m.mailboxId,
      mailboxAddress: m.mailbox.address,
      threadId: m.message.threadId,
      fromAddress: m.message.fromAddress,
      fromName: m.message.fromName || m.message.fromAddress,
      subject: m.message.subject || "(no subject)",
      snippet: m.message.thread?.snippet || "",
      messageCount: m.message.thread?.messageCount || 1,
      folder: m.folder,
      isRead: m.isRead,
      isStarred: m.isStarred,
      isArchived: m.isArchived,
      isDeleted: m.isDeleted,
      date: m.message.receivedAt || m.createdAt,
      direction: m.message.direction,
      attachmentsCount: m.message.attachments.length,
      hasAttachments: m.message.attachments.length > 0,
      attachments: m.message.attachments,
    }));

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      unreadCount,
    });
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages", details: error?.message },
      { status: 500 }
    );
  }
}
