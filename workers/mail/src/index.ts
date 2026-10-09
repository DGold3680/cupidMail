import { Env, ForwardableEmailMessage } from "./types";
import { handleIncomingEmail, ingestEmailBytes } from "./ingestion";
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
   * HTTP endpoint for healthcheck, inbound webhook, manual retry, and status
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Inbound Webhook (Raw RFC822 / .eml, JSON, or multipart/form-data)
    if (url.pathname === "/api/inbound" && request.method === "POST") {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Inbound-Recipient, X-Inbound-Sender",
      };

      try {
        const contentType = request.headers.get("content-type") || "";
        let rawBytes: ArrayBuffer | Uint8Array;
        let envelopeTo =
          request.headers.get("x-inbound-recipient") ||
          url.searchParams.get("recipient") ||
          url.searchParams.get("to") ||
          undefined;
        let envelopeFrom =
          request.headers.get("x-inbound-sender") ||
          url.searchParams.get("sender") ||
          url.searchParams.get("from") ||
          undefined;

        if (contentType.includes("application/json")) {
          const body = (await request.json()) as any;
          envelopeTo = envelopeTo || body.to || body.recipient;
          envelopeFrom = envelopeFrom || body.from || body.sender;

          if (body.raw) {
            if (typeof body.raw === "string") {
              const trimmed = body.raw.trim();
              const isBase64 =
                /^[A-Za-z0-9+/=]+$/.test(trimmed) &&
                trimmed.length % 4 === 0 &&
                !trimmed.includes(" ");
              if (isBase64) {
                const binaryStr = atob(trimmed);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                rawBytes = bytes;
              } else {
                rawBytes = new TextEncoder().encode(trimmed);
              }
            } else {
              throw new Error("Invalid raw payload in JSON");
            }
          } else if (body.text || body.html || body.subject) {
            const subject = body.subject || "(no subject)";
            const text = body.text || "";
            const html = body.html || "";
            const emlText = [
              `From: ${envelopeFrom || "sender@external.com"}`,
              `To: ${envelopeTo || "admin@runnly.xyz"}`,
              `Subject: ${subject}`,
              `Date: ${new Date().toUTCString()}`,
              `MIME-Version: 1.0`,
              `Content-Type: ${html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8"}`,
              ``,
              html || text,
            ].join("\r\n");
            rawBytes = new TextEncoder().encode(emlText);
          } else {
            return new Response(
              JSON.stringify({
                error: "Missing email content: provide 'raw' or 'subject'/'text'/'html'",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
        } else if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          const rawFile =
            formData.get("raw") ||
            formData.get("email") ||
            formData.get("message") ||
            formData.get("file");
          envelopeTo =
            envelopeTo ||
            (formData.get("to") as string) ||
            (formData.get("recipient") as string);
          envelopeFrom =
            envelopeFrom ||
            (formData.get("from") as string) ||
            (formData.get("sender") as string);

          if (rawFile && typeof rawFile !== "string") {
            rawBytes = await (rawFile as Blob).arrayBuffer();
          } else if (typeof rawFile === "string") {
            rawBytes = new TextEncoder().encode(rawFile);
          } else {
            const subject = (formData.get("subject") as string) || "(no subject)";
            const text = (formData.get("text") as string) || "";
            const html = (formData.get("html") as string) || "";
            const emlText = [
              `From: ${envelopeFrom || "sender@external.com"}`,
              `To: ${envelopeTo || "admin@runnly.xyz"}`,
              `Subject: ${subject}`,
              `Date: ${new Date().toUTCString()}`,
              `MIME-Version: 1.0`,
              `Content-Type: ${html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8"}`,
              ``,
              html || text,
            ].join("\r\n");
            rawBytes = new TextEncoder().encode(emlText);
          }
        } else {
          // Direct raw stream (message/rfc822, application/octet-stream, text/plain)
          rawBytes = await request.arrayBuffer();
        }

        const result = await ingestEmailBytes(rawBytes, {
          envelopeTo,
          envelopeFrom,
          env,
          allowAdminFallback: true,
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: "Email received and processed",
            ...result,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (err: any) {
        console.error("[Inbound Webhook] Error:", err);
        return new Response(
          JSON.stringify({
            success: false,
            error: err?.message || String(err),
          }),
          {
            status: err?.message?.includes("No active mailbox") ? 404 : 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    if (url.pathname === "/api/inbound" && request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Inbound-Recipient, X-Inbound-Sender",
        },
      });
    }

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
