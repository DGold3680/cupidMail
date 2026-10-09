import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@mymail/database";
import { sanitizeEmailHtml } from "@mymail/mail-core";

export const dynamic = "force-dynamic";

/**
 * GET /api/emails/messages/[id]
 * Fetches full message details, sanitized HTML, attachments, and thread conversation history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const allowRemoteImages = searchParams.get("allowImages") === "true";

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        recipients: true,
        attachments: true,
        mailboxMessages: {
          include: {
            mailbox: {
              select: {
                id: true,
                address: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Auto mark as read in all associated mailboxes
    await prisma.mailboxMessage.updateMany({
      where: { messageId: id, isRead: false },
      data: { isRead: true },
    });

    // Sanitize HTML body
    const safeHtml = message.htmlBody
      ? sanitizeEmailHtml(message.htmlBody, { allowRemoteImages })
      : null;

    // Fetch thread messages for conversation view
    const threadMessages = await prisma.message.findMany({
      where: { threadId: message.threadId },
      orderBy: { createdAt: "asc" },
      include: {
        recipients: true,
        attachments: true,
      },
    });

    const threadHistory = threadMessages.map((m) => ({
      id: m.id,
      fromAddress: m.fromAddress,
      fromName: m.fromName || m.fromAddress,
      subject: m.subject,
      textBody: m.textBody,
      htmlBody: m.htmlBody ? sanitizeEmailHtml(m.htmlBody, { allowRemoteImages }) : null,
      direction: m.direction,
      date: m.sentAt || m.receivedAt || m.createdAt,
      recipients: m.recipients,
      attachments: m.attachments,
    }));

    return NextResponse.json({
      message: {
        id: message.id,
        threadId: message.threadId,
        internetMessageId: message.internetMessageId,
        fromAddress: message.fromAddress,
        fromName: message.fromName || message.fromAddress,
        subject: message.subject,
        textBody: message.textBody,
        htmlBody: safeHtml,
        rawHtmlBody: message.htmlBody,
        direction: message.direction,
        sentAt: message.sentAt,
        receivedAt: message.receivedAt,
        inReplyTo: message.inReplyTo,
        references: message.references,
        recipients: message.recipients,
        attachments: message.attachments,
        mailboxMessages: message.mailboxMessages,
      },
      threadHistory,
    });
  } catch (error: any) {
    console.error("Error fetching message details:", error);
    return NextResponse.json(
      { error: "Failed to fetch message details", details: error?.message },
      { status: 500 }
    );
  }
}
