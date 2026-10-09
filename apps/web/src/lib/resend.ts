import { Resend } from "resend";
import { prisma } from "@mymail/database";
import { decryptCredentials } from "@mymail/mail-core";
import { SendEmailPayload, SendResult } from "@mymail/mail-core";

/**
 * Resolves the Resend API client for a specific domain or user.
 * Implements BYOK (Bring Your Own Key) with fallback to global RESEND_API_KEY.
 */
export async function getResendClientForDomain(
  domainId: string,
  userId?: string
): Promise<{ client: Resend; providerConnectionId?: string }> {
  // 1. Try finding domain-specific sending configuration
  const sendingConfig = await prisma.domainSendingConfig.findUnique({
    where: { domainId },
    include: { providerConnection: true },
  });

  if (
    sendingConfig &&
    sendingConfig.enabled &&
    sendingConfig.providerConnection &&
    sendingConfig.providerConnection.status === "ACTIVE"
  ) {
    try {
      const apiKey = decryptCredentials(
        sendingConfig.providerConnection.encryptedCredentials
      );
      return {
        client: new Resend(apiKey),
        providerConnectionId: sendingConfig.providerConnection.id,
      };
    } catch (err) {
      console.error("Failed to decrypt domain Resend credentials:", err);
    }
  }

  // 2. Try finding user's active Resend provider connection
  if (userId) {
    const userConnection = await prisma.emailProviderConnection.findFirst({
      where: {
        userId,
        provider: "RESEND",
        status: "ACTIVE",
      },
    });

    if (userConnection) {
      try {
        const apiKey = decryptCredentials(userConnection.encryptedCredentials);
        return {
          client: new Resend(apiKey),
          providerConnectionId: userConnection.id,
        };
      } catch (err) {
        console.error("Failed to decrypt user Resend credentials:", err);
      }
    }
  }

  // 3. Fallback to global environment variable RESEND_API_KEY
  const globalApiKey = process.env.RESEND_API_KEY;
  if (globalApiKey) {
    return { client: new Resend(globalApiKey) };
  }

  throw new Error(
    "No active Resend sending configuration found. Please connect your Resend API key in Settings > Email Providers."
  );
}

/**
 * Dispatches an outgoing email via Resend
 */
export async function dispatchOutgoingEmail(
  payload: SendEmailPayload,
  userId?: string
): Promise<SendResult> {
  // 1. Verify mailbox and get domain
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: payload.mailboxId },
    include: { domain: true },
  });

  if (!mailbox) {
    return {
      success: false,
      messageId: "",
      error: "Sender mailbox not found",
    };
  }

  // 2. Get Resend client for this domain
  const { client, providerConnectionId } = await getResendClientForDomain(
    mailbox.domainId,
    userId
  );

  // 3. Prepare headers for threading (RFC-compliant)
  const headers: Record<string, string> = {};
  if (payload.inReplyTo) {
    headers["In-Reply-To"] = payload.inReplyTo;
  }
  if (payload.references) {
    headers["References"] = payload.references;
  }

  // 4. Prepare recipients
  const toList = payload.to.map((r) => (r.name ? `${r.name} <${r.address}>` : r.address));
  const ccList = payload.cc?.map((r) => (r.name ? `${r.name} <${r.address}>` : r.address));
  const bccList = payload.bcc?.map((r) => (r.name ? `${r.name} <${r.address}>` : r.address));

  // 5. Prepare attachments
  const attachments = payload.attachments?.map((att) => ({
    filename: att.filename,
    content: att.content, // base64
  }));

  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "runnly.xyz";
  const isCustomDomain = mailbox.domain.name.toLowerCase() !== baseDomain.toLowerCase();
  const hasCustomProvider = Boolean(providerConnectionId);

  try {
    let fromSender: string;
    const replyToAddress = payload.replyTo || payload.fromAddress;

    if (isCustomDomain && !hasCustomProvider) {
      // Sent on their behalf via platform domain
      const platformSender = `${mailbox.localPart}@${baseDomain}`;
      const displayName = payload.fromName || mailbox.displayName || mailbox.address;
      fromSender = `${displayName} (via ${baseDomain}) <${platformSender}>`;
    } else {
      fromSender = payload.fromName
        ? `${payload.fromName} <${payload.fromAddress}>`
        : payload.fromAddress;
    }

    const emailOptions: any = {
      from: fromSender,
      to: toList,
      subject: payload.subject,
      ...(payload.htmlBody ? { html: payload.htmlBody } : {}),
      ...(payload.textBody ? { text: payload.textBody } : {}),
      ...(!payload.htmlBody && !payload.textBody ? { text: "" } : {}),
      ...(ccList && ccList.length > 0 ? { cc: ccList } : {}),
      ...(bccList && bccList.length > 0 ? { bcc: bccList } : {}),
      replyTo: replyToAddress,
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };

    const resendResult = await client.emails.send(emailOptions);

    if (resendResult.error) {
      return {
        success: false,
        messageId: "",
        error: resendResult.error.message,
      };
    }

    return {
      success: true,
      messageId: "",
      providerMessageId: resendResult.data?.id,
    };
  } catch (error: any) {
    console.error("Resend delivery failed:", error);
    return {
      success: false,
      messageId: "",
      error: error?.message || "Failed to deliver email through Resend",
    };
  }
}
