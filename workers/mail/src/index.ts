import { Env, ForwardableEmailMessage } from "./types";
import { handleIncomingEmail } from "./ingestion";
import { handleScheduledRecovery } from "./recovery";
import { createSupabase } from "./supabase";

export default {
  /**
   * Cloudflare Email Routing entrypoint
   */
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleIncomingEmail(message, env, ctx);
  },

  /**
   * Cloudflare Cron Trigger entrypoint (runs every 15 min for recovery)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleScheduledRecovery(event, env, ctx);
  },

  /**
   * HTTP endpoint for healthcheck, manual retry, and status
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "mymail-worker",
          timestamp: new Date().toISOString(),
          cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Manual Trigger for Recovery (protected by ADMIN_API_SECRET if set)
    if (url.pathname === "/api/recovery/run" && request.method === "POST") {
      const authHeader = request.headers.get("Authorization");
      if (env.ADMIN_API_SECRET && authHeader !== `Bearer ${env.ADMIN_API_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      await handleScheduledRecovery({} as any, env, ctx);
      return new Response(JSON.stringify({ success: true, message: "Recovery triggered" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Diagnostics: check recent ingestion jobs
    if (url.pathname === "/api/ingestion/status" && request.method === "GET") {
      const authHeader = request.headers.get("Authorization");
      if (env.ADMIN_API_SECRET && authHeader !== `Bearer ${env.ADMIN_API_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      const supabase = createSupabase(env);
      const { data, error } = await supabase
        .from("ingestion_jobs")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({ jobs: data, error }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
