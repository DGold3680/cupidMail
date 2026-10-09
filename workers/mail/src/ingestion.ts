import PostalMime from "postal-mime";
import { Env, ForwardableEmailMessage } from "./types";
import { uploadRawEmailToCloudinary, uploadAttachmentToCloudinary } from "./cloudinary";
import {
  createSupabase,
  validateRecipient,
  resolveCandidateRecipients,
  findAdminMailbox,
  findOrCreateThread,
  RecipientLookup,
} from "./supabase";

/**
 * Extracts all candidate recipient addresses from envelope, parsed headers, and routing metadata
 */
export function extractCandidateRecipients(
  envelopeTo?: string,
  parsed?: any,
  rawHeaders?: Headers | Record<string, string>
): string[] {
  const candidates = new Set<string>();

  // 1. Envelope To
  if (envelopeTo) {
    const cleanTo = envelopeTo.toLowerCase().trim();
    candidates.add(cleanTo);

    // Plus addressing: e.g. inbound+admin=jambacademy.com@runnly.xyz
    const plusMatch = cleanTo.match(
      /^([a-z0-9._%+-]+)\+([a-z0-9._%+-]+)=([a-z0-9.-]+\.[a-z]{2,})@[a-z0-9.-]+$/i
    );
    if (plusMatch) {
      candidates.add(`${plusMatch[2]}@${plusMatch[3]}`.toLowerCase().trim());
    }

    // Plus addressing with @: e.g. inbound+admin@jambacademy.com@runnly.xyz
    const plusAtMatch = cleanTo.match(
      /^([a-z0-9._%+-]+)\+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})@[a-z0-9.-]+$/i
    );
    if (plusAtMatch) {
      candidates.add(plusAtMatch[2].toLowerCase().trim());
    }
  }

  // 2. MIME To addresses
  if (parsed?.to && Array.isArray(parsed.to)) {
    for (const item of parsed.to) {
      if (item.address) {
        candidates.add(item.address.toLowerCase().trim());
      }
    }
  }

  // 3. MIME Cc addresses
  if (parsed?.cc && Array.isArray(parsed.cc)) {
    for (const item of parsed.cc) {
      if (item.address) {
        candidates.add(item.address.toLowerCase().trim());
      }
    }
  }

  // 4. PostalMime parsed headers (e.g. X-Original-To, X-Forwarded-To, Delivered-To, Envelope-To)
  if (parsed?.headers && Array.isArray(parsed.headers)) {
    for (const h of parsed.headers) {
      const key = (h.key || "").toLowerCase();
      if (
        key === "x-original-to" ||
        key === "x-forwarded-to" ||
        key === "delivered-to" ||
        key === "envelope-to" ||
        key === "x-envelope-to" ||
        key === "to"
      ) {
        if (typeof h.value === "string") {
          const match = h.value.match(/<([^>]+)>/) || [null, h.value];
          const addr = match[1] ? match[1].toLowerCase().trim() : "";
          if (addr && addr.includes("@")) {
            candidates.add(addr);
          }
        }
      }
    }
  }

  return Array.from(candidates);
}

export interface IngestionResult {
  messageId: string;
  ingestionId: string;
  deliveredTo: string[];
}

/**
 * Universal email ingestion function:
 * Accepts raw email bytes, parses MIME, discovers active mailbox recipients,
 * persists raw message and attachments in Cloudinary, and links into INBOX.
 */
export async function ingestEmailBytes(
  rawBytes: ArrayBuffer | Uint8Array,
  options: {
    envelopeTo?: string;
    envelopeFrom?: string;
    env: Env;
    allowAdminFallback?: boolean;
  }
): Promise<IngestionResult> {
  const { envelopeTo, envelopeFrom, env, allowAdminFallback = true } = options;
  const supabase = createSupabase(env);

  // 1. Parse email with PostalMime
  const parser = new PostalMime();
  const parsed = await parser.parse(rawBytes);

  // 2. Discover all candidate recipients
  const candidateAddresses = extractCandidateRecipients(envelopeTo, parsed);
  console.log(`[Ingestion] Candidate recipient addresses:`, candidateAddresses);

  // 3. Resolve candidate addresses against active mailboxes & aliases in Supabase
  let matchingLookups = await resolveCandidateRecipients(supabase, candidateAddresses);

  // 4. Verification Email Fallback (e.g. Cloudflare Email Routing verify sent to inbound@runnly.xyz)
  const subject = parsed.subject || "";
  const sender = parsed.from?.address || envelopeFrom || "unknown";
  const isVerificationEmail =
    subject.toLowerCase().includes("verify") ||
    subject.toLowerCase().includes("verification") ||
    sender.toLowerCase().includes("cloudflare.com");

  if (matchingLookups.length === 0 && allowAdminFallback && isVerificationEmail) {
    const adminLookup = await findAdminMailbox(supabase);
    if (adminLookup) {
      console.log(`[Ingestion] Routing verification email to platform admin mailbox: ${adminLookup.address}`);
      matchingLookups = [adminLookup];
    }
  }

  if (matchingLookups.length === 0) {
    throw new Error(
      `No active mailbox found for candidate recipients: [${candidateAddresses.join(", ")}]`
    );
  }

  const primaryRecipient = matchingLookups[0].address;
  const mailboxIds = matchingLookups.map((m) => m.mailboxId);

  // 5. Upload Raw Email to Cloudinary BEFORE processing (Durable source of truth!)
  const ingestionId = crypto.randomUUID();
  const rawStorageKey = `emails/raw/${ingestionId}`;

  let rawUploadResult: any;
  try {
    rawUploadResult = await uploadRawEmailToCloudinary(env, rawStorageKey, rawBytes);
    console.log(`[Ingestion] Successfully persisted raw email to Cloudinary: ${rawUploadResult.secure_url}`);
  } catch (err: any) {
    console.error(`[Ingestion] Failed to upload raw email to Cloudinary:`, err);
    throw new Error(`Cloudinary raw storage error: ${err?.message || String(err)}`);
  }

  // 6. Record Ingestion Job in Supabase
  await supabase.from("ingestion_jobs").insert({
    id: ingestionId,
    storage_key: rawUploadResult.secure_url || rawStorageKey,
    recipient: primaryRecipient,
    sender,
    status: "PROCESSING",
    attempt_count: 1,
    received_at: new Date().toISOString(),
  });

  // 7. Parse and Process Content
  try {
    const messageId = await processEmailContent({
      ingestionId,
      rawBytes,
      rawStorageKey: rawUploadResult.secure_url || rawStorageKey,
      mailboxIds,
      recipient: primaryRecipient,
      sender,
      env,
      supabase,
    });

    // Mark completed
    await supabase
      .from("ingestion_jobs")
      .update({
        status: "COMPLETED",
        processed_at: new Date().toISOString(),
      })
      .eq("id", ingestionId);

    console.log(`[Ingestion] Successfully processed email ${ingestionId} -> ${messageId}`);

    return {
      messageId,
      ingestionId,
      deliveredTo: matchingLookups.map((m) => m.address),
    };
  } catch (err: any) {
    console.error(`[Ingestion] Error during email parsing/saving:`, err);
    await supabase
      .from("ingestion_jobs")
      .update({
        status: "FAILED",
        last_error: err?.message || String(err),
      })
      .eq("id", ingestionId);
    throw err;
  }
}

/**
 * Cloudflare Email Routing event handler
 */
export async function handleIncomingEmail(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const recipient = message.to.toLowerCase();
  const sender = message.from;

  console.log(`[Ingestion] Received email via Cloudflare Email Routing from ${sender} to ${recipient}`);

  try {
    const rawBytes = await new Response(message.raw).arrayBuffer();
    const result = await ingestEmailBytes(rawBytes, {
      envelopeTo: recipient,
      envelopeFrom: sender,
      env,
      allowAdminFallback: true,
    });
    console.log(
      `[Ingestion] Successfully ingested email ${result.messageId} delivered to [${result.deliveredTo.join(", ")}]`
    );
  } catch (err: any) {
    console.warn(`[Ingestion] Rejected email:`, err?.message || err);
    message.setReject(err?.message || "Unknown recipient address");
  }
}

interface ProcessOptions {
  ingestionId: string;
  rawBytes: ArrayBuffer | Uint8Array;
  rawStorageKey: string;
  mailboxId?: string;
  mailboxIds?: string[];
  recipient: string;
  sender: string;
  env: Env;
  supabase: any;
}

/**
 * Shared email parsing and database insertion logic (also used by recovery)
 */
export async function processEmailContent(options: ProcessOptions): Promise<string> {
  const {
    ingestionId,
    rawBytes,
    rawStorageKey,
    mailboxId,
    recipient,
    sender,
    env,
    supabase,
  } = options;

  const parser = new PostalMime();
  const parsed = await parser.parse(rawBytes);

  const subject = parsed.subject || "(no subject)";
  const textBody = parsed.text || "";
  const htmlBody = parsed.html || "";
  const snippet = (textBody || subject).slice(0, 180).replace(/\s+/g, " ").trim();
  const messageId = crypto.randomUUID();
  const internetMessageId = parsed.messageId || `<${messageId}@inbound.local>`;

  // 1. Thread Resolution
  const threadId = await findOrCreateThread(
    supabase,
    subject,
    snippet,
    parsed.inReplyTo,
    parsed.references
  );

  // 2. Insert Message record
  const { error: msgErr } = await supabase.from("messages").insert({
    id: messageId,
    ingestion_id: ingestionId,
    internet_message_id: internetMessageId,
    thread_id: threadId,
    from_address: parsed.from?.address || sender,
    from_name: parsed.from?.name || null,
    subject,
    text_body: textBody,
    html_body: htmlBody,
    raw_storage_key: rawStorageKey,
    direction: "INBOUND",
    received_at: parsed.date || new Date().toISOString(),
    in_reply_to: parsed.inReplyTo || null,
    references: parsed.references || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (msgErr) {
    throw new Error(`Failed to insert message record: ${msgErr.message}`);
  }

  // 3. Insert Recipients
  const recipientsToInsert: any[] = [];

  if (parsed.to && Array.isArray(parsed.to)) {
    for (const to of parsed.to) {
      if (to.address) {
        recipientsToInsert.push({
          id: crypto.randomUUID(),
          message_id: messageId,
          address: to.address.toLowerCase(),
          name: to.name || null,
          recipient_type: "TO",
        });
      }
    }
  }

  if (parsed.cc && Array.isArray(parsed.cc)) {
    for (const cc of parsed.cc) {
      if (cc.address) {
        recipientsToInsert.push({
          id: crypto.randomUUID(),
          message_id: messageId,
          address: cc.address.toLowerCase(),
          name: cc.name || null,
          recipient_type: "CC",
        });
      }
    }
  }

  if (!recipientsToInsert.some((r) => r.address === recipient)) {
    recipientsToInsert.push({
      id: crypto.randomUUID(),
      message_id: messageId,
      address: recipient,
      name: null,
      recipient_type: "TO",
    });
  }

  if (recipientsToInsert.length > 0) {
    await supabase.from("message_recipients").insert(recipientsToInsert);
  }

  // 4. Handle Attachments via Cloudinary
  if (parsed.attachments && parsed.attachments.length > 0) {
    for (const att of parsed.attachments) {
      const attId = crypto.randomUUID();
      const filename = att.filename || "untitled";
      const publicId = `emails/attachments/${messageId}/${attId}-${filename}`;

      const contentBuffer: ArrayBuffer | Uint8Array =
        typeof att.content === "string"
          ? new TextEncoder().encode(att.content)
          : att.content;
      const sizeBytes =
        contentBuffer instanceof Uint8Array
          ? contentBuffer.byteLength
          : contentBuffer.byteLength;

      // Upload attachment content to Cloudinary
      const attUploadResult = await uploadAttachmentToCloudinary(
        env,
        publicId,
        contentBuffer,
        filename,
        att.mimeType || "application/octet-stream"
      );

      // Record in DB
      await supabase.from("attachments").insert({
        id: attId,
        message_id: messageId,
        filename,
        content_type: att.mimeType || "application/octet-stream",
        size_bytes: sizeBytes,
        storage_key: attUploadResult.secure_url || publicId,
        content_id: att.contentId || null,
        is_inline: att.disposition === "inline",
        created_at: new Date().toISOString(),
      });
    }
  }

  // 5. Link to Mailbox in INBOX folder
  const targetMailboxIds =
    options.mailboxIds && options.mailboxIds.length > 0
      ? options.mailboxIds
      : options.mailboxId
      ? [options.mailboxId]
      : [];

  for (const targetId of targetMailboxIds) {
    await supabase.from("mailbox_messages").insert({
      id: crypto.randomUUID(),
      mailbox_id: targetId,
      message_id: messageId,
      folder: "INBOX",
      is_read: false,
      is_starred: false,
      is_archived: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
    });
  }

  return messageId;
}
