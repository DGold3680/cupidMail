import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Env } from "./types";

export function createSupabase(env: Env): SupabaseClient {
  const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(env.SUPABASE_URL, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface RecipientLookup {
  mailboxId: string;
  address: string;
}

/**
 * Validates whether the recipient exists as a direct mailbox or alias
 */
export async function validateRecipient(
  supabase: SupabaseClient,
  recipient: string
): Promise<RecipientLookup | null> {
  const normalized = recipient.toLowerCase().trim();

  // 1. Check direct mailbox
  const { data: mailbox, error: mbError } = await supabase
    .from("mailboxes")
    .select("id, address, status")
    .eq("address", normalized)
    .single();

  if (mailbox && mailbox.status === "ACTIVE") {
    return { mailboxId: mailbox.id, address: mailbox.address };
  }

  // 2. Check alias
  const { data: alias, error: alError } = await supabase
    .from("aliases")
    .select("id, address, target_mailbox_id, enabled")
    .eq("address", normalized)
    .single();

  if (alias && alias.enabled) {
    return { mailboxId: alias.target_mailbox_id, address: alias.address };
  }

  return null;
}

/**
 * Creates or finds an existing thread based on normalized subject or RFC In-Reply-To
 */
export async function findOrCreateThread(
  supabase: SupabaseClient,
  subject: string,
  snippet: string,
  inReplyTo?: string,
  references?: string
): Promise<string> {
  // If inReplyTo exists, try to find the message it references
  if (inReplyTo) {
    const { data: existingMsg } = await supabase
      .from("messages")
      .select("thread_id")
      .eq("internet_message_id", inReplyTo)
      .limit(1)
      .single();

    if (existingMsg?.thread_id) {
      // Update thread
      await supabase
        .from("threads")
        .update({
          snippet,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMsg.thread_id);

      return existingMsg.thread_id;
    }
  }

  // Normalize subject (remove Re:, Fwd:, etc.)
  const normalizedSubject = subject
    .replace(/^((re|fwd|fw):\s*)+/gi, "")
    .trim()
    .toLowerCase() || "(no subject)";

  // Try finding a recent thread with matching subject within last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: threadBySubject } = await supabase
    .from("threads")
    .select("id")
    .eq("subject_normalized", normalizedSubject)
    .gte("last_message_at", thirtyDaysAgo)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .single();

  if (threadBySubject?.id) {
    await supabase
      .from("threads")
      .update({
        snippet,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadBySubject.id);

    return threadBySubject.id;
  }

  // Create new thread
  const newThreadId = crypto.randomUUID();
  const { error } = await supabase.from("threads").insert({
    id: newThreadId,
    subject_normalized: normalizedSubject,
    snippet,
    last_message_at: new Date().toISOString(),
    message_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error creating thread:", error);
  }

  return newThreadId;
}
