import PostalMime from "postal-mime";
import { Env, ForwardableEmailMessage } from "./types";
import { uploadRawEmailToCloudinary, uploadAttachmentToCloudinary } from "./cloudinary";
import { createSupabase, validateRecipient, findOrCreateThread } from "./supabase";

/**
 * Main email ingestion handler for Cloudflare Email Routing
 */
export async function handleIncomingEmail(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const supabase = createSupabase(env);
  const recipient = message.to.toLowerCase();
  const sender = message.from;

  console.log(`[Ingestion] Received email from ${sender} to ${recipient}`);

  // 1. Validate Recipient
  const recipientLookup = await validateRecipient(supabase, recipient);
  if (!recipientLookup) {
    console.warn(`[Ingestion] Unknown or disabled recipient: ${recipient}`);
    message.setReject("Unknown recipient address");
    return;
  }

  // 2. Read raw email bytes into buffer
  const rawBytes = await new Response(message.raw).arrayBuffer();
  const ingestionId = crypto.randomUUID();
  const rawStorageKey = `emails/raw/${ingestionId}`;

  // 3. Upload Raw Email to Cloudinary BEFORE parsing (Durable source of truth!)
  let rawUploadResult: any;
  try {
    rawUploadResult = await uploadRawEmailToCloudinary(env, rawStorageKey, rawBytes);
    console.log(`[Ingestion] Successfully persisted raw email to Cloudinary: ${rawUploadResult.secure_url}`);
  } catch (err: any) {
    console.error(`[Ingestion] Failed to upload raw email to Cloudinary:`, err);
    message.setReject("Internal storage error");
    throw err;
  }

  // 4. Create Ingestion Record in Supabase
  await supabase.from("ingestion_jobs").insert({
    id: ingestionId,
    storage_key: rawUploadResult.secure_url || rawStorageKey,
    recipient,
    sender,
    status: "PROCESSING",
    attempt_count: 1,
    received_at: new Date().toISOString(),
  });

  // 5. Parse and Process Message
  try {
    await processEmailContent({
      ingestionId,
      rawBytes,
      rawStorageKey: rawUploadResult.secure_url || rawStorageKey,
      mailboxId: recipientLookup.mailboxId,
      recipient,
      sender,
      env,
      supabase,
    });

    // Mark ingestion job completed
    await supabase
      .from("ingestion_jobs")
      .update({
        status: "COMPLETED",
        processed_at: new Date().toISOString(),
      })
      .eq("id", ingestionId);

    console.log(`[Ingestion] Successfully processed email ${ingestionId}`);
  } catch (err: any) {
    console.error(`[Ingestion] Error during email parsing/saving:`, err);
    await supabase
      .from("ingestion_jobs")
      .update({
        status: "FAILED",
        last_error: err?.message || String(err),
      })
      .eq("id", ingestionId);
  }
}

interface ProcessOptions {
  ingestionId: string;
  rawBytes: ArrayBuffer;
  rawStorageKey: string;
  mailboxId: string;
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
  await supabase.from("mailbox_messages").insert({
    id: crypto.randomUUID(),
    mailbox_id: mailboxId,
    message_id: messageId,
    folder: "INBOX",
    is_read: false,
    is_starred: false,
    is_archived: false,
    is_deleted: false,
    created_at: new Date().toISOString(),
  });

  return messageId;
}
