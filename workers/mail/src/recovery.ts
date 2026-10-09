import { Env } from "./types";
import { fetchRawEmailFromCloudinary } from "./cloudinary";
import { createSupabase, validateRecipient } from "./supabase";
import { processEmailContent } from "./ingestion";

/**
 * Scheduled Cron Trigger: runs every 15 mins to recover failed/incomplete ingestions
 */
export async function handleScheduledRecovery(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`[Recovery] Running scheduled recovery check at ${new Date().toISOString()}`);

  const supabase = createSupabase(env);

  // Look for jobs that are FAILED or stuck in PROCESSING/RECEIVED
  const { data: stuckJobs, error } = await supabase
    .from("ingestion_jobs")
    .select("*")
    .in("status", ["RECEIVED", "PROCESSING", "FAILED"])
    .lt("attempt_count", 5)
    .order("received_at", { ascending: true })
    .limit(10);

  if (error || !stuckJobs || stuckJobs.length === 0) {
    console.log("[Recovery] No incomplete or failed ingestion jobs found.");
    return;
  }

  console.log(`[Recovery] Found ${stuckJobs.length} incomplete jobs to recover.`);

  for (const job of stuckJobs) {
    try {
      console.log(`[Recovery] Attempting to reprocess job ${job.id} (attempt ${job.attempt_count + 1})`);

      // 1. Validate recipient
      const recipientLookup = await validateRecipient(supabase, job.recipient);
      if (!recipientLookup) {
        console.warn(`[Recovery] Recipient no longer valid for job ${job.id}: ${job.recipient}`);
        await supabase
          .from("ingestion_jobs")
          .update({
            status: "FAILED",
            last_error: "Recipient not found during recovery",
            attempt_count: job.attempt_count + 1,
          })
          .eq("id", job.id);
        continue;
      }

      // 2. Fetch raw email bytes from Cloudinary
      const rawBytes = await fetchRawEmailFromCloudinary(env, job.storage_key);

      // 3. Process email
      await processEmailContent({
        ingestionId: job.id,
        rawBytes,
        rawStorageKey: job.storage_key,
        mailboxId: recipientLookup.mailboxId,
        recipient: job.recipient,
        sender: job.sender || "",
        env,
        supabase,
      });

      // 4. Update job to completed
      await supabase
        .from("ingestion_jobs")
        .update({
          status: "COMPLETED",
          attempt_count: job.attempt_count + 1,
          processed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", job.id);

      console.log(`[Recovery] Successfully recovered job ${job.id}`);
    } catch (err: any) {
      console.error(`[Recovery] Failed to recover job ${job.id}:`, err);
      await supabase
        .from("ingestion_jobs")
        .update({
          status: "FAILED",
          attempt_count: job.attempt_count + 1,
          last_error: err?.message || String(err),
        })
        .eq("id", job.id);
    }
  }
}
