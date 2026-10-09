import { NextRequest, NextResponse } from "next/server";
import { prisma, MailFolder, MessageDirection, RecipientType, DeliveryStatus } from "@mymail/database";
import { dispatchOutgoingEmail } from "@/lib/resend";
import { SendEmailPayload } from "@mymail/mail-core";

export const dynamic = "force-dynamic";

/**
 * POST /api/emails/send
 * Sends an email via Resend BYOK and records the outbound message in database.
 */
export async function POST(req: NextRequest) {
  try {
    const payload: SendEmailPayload = await req.json();

    if (!payload.mailboxId || !payload.fromAddress || !payload.to || payload.to.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: mailboxId, fromAddress, to" },
        { status: 400 }
      );
    }

    // 1. Validate sender mailbox
    const mailbox = await prisma.mailbox.findUnique({
      where: { id: payload.mailboxId },
      include: { domain: true },
    });

    if (!mailbox) {
      return NextResponse.json(
        { error: "Sender mailbox not found" },
        { status: 404 }
      );
    }

    // 2. Dispatch via Resend (BYOK)
    const sendResult = await dispatchOutgoingEmail(payload);

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || "Failed to dispatch email via Resend" },
        { status: 502 }
      );
    }

    // 3. Resolve Thread
    let threadId = payload.threadId;
    const snippet = (payload.textBody || payload.subject).slice(0, 180).trim();

    if (threadId) {
      await prisma.thread.update({
        where: { id: threadId },
        data: {
          snippet,
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
        },
      });
    } else {
      const normalizedSubject = payload.subject
        .replace(/^((re|fwd|fw):\s*)+/gi, "")
        .trim()
        .toLowerCase() || "(no subject)";

      const newThread = await prisma.thread.create({
        data: {
          subjectNormalized: normalizedSubject,
          snippet,
          lastMessageAt: new Date(),
          messageCount: 1,
        },
      });
      threadId = newThread.id;
    }

    // 4. Save outbound Message record
    const messageId = crypto.randomUUID();
    const internetMessageId = `<${messageId}@${mailbox.domain.name}>`;

    const message = await prisma.message.create({
      data: {
        id: messageId,
        threadId,
        internetMessageId,
        fromAddress: payload.fromAddress,
        fromName: payload.fromName || null,
        replyTo: payload.replyTo || null,
        subject: payload.subject,
        textBody: payload.textBody || null,
        htmlBody: payload.htmlBody || null,
        direction: MessageDirection.OUTBOUND,
        sentAt: new Date(),
        receivedAt: new Date(),
        inReplyTo: payload.inReplyTo || null,
        references: payload.references || null,
      },
    });

    // 5. Insert Recipients
    const recipientInserts = [
      ...payload.to.map((r) => ({
        messageId,
        address: r.address.toLowerCase(),
        name: r.name || null,
        recipientType: RecipientType.TO,
      })),
      ...(payload.cc || []).map((r) => ({
        messageId,
        address: r.address.toLowerCase(),
        name: r.name || null,
        recipientType: RecipientType.CC,
      })),
      ...(payload.bcc || []).map((r) => ({
        messageId,
        address: r.address.toLowerCase(),
        name: r.name || null,
        recipientType: RecipientType.BCC,
      })),
    ];

    await prisma.messageRecipient.createMany({
      data: recipientInserts,
    });

    // 6. Link to Mailbox in SENT folder
    await prisma.mailboxMessage.create({
      data: {
        mailboxId: payload.mailboxId,
        messageId,
        folder: MailFolder.SENT,
        isRead: true,
        isStarred: false,
      },
    });

    // 7. Track delivery status
    if (sendResult.providerMessageId) {
      await prisma.outgoingDelivery.create({
        data: {
          messageId,
          provider: "RESEND",
          providerMessageId: sendResult.providerMessageId,
          status: DeliveryStatus.SENDING,
        },
      });
    }

    return NextResponse.json({
      success: true,
      messageId,
      providerMessageId: sendResult.providerMessageId,
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Internal server error while sending email", details: error?.message },
      { status: 500 }
    );
  }
}
