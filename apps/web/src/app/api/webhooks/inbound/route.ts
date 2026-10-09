import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORKER_INBOUND_URL =
  process.env.WORKER_URL
    ? `${process.env.WORKER_URL}/api/inbound`
    : "https://mymail-worker.runnly.workers.dev/api/inbound";

/**
 * GET /api/webhooks/inbound
 * Status and diagnostic info for the inbound webhook gateway
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "mymail-inbound-webhook-gateway",
    targetWorkerUrl: WORKER_INBOUND_URL,
    instructions: {
      postFormats: [
        "Raw RFC822 / .eml body (Content-Type: message/rfc822)",
        "JSON payload ({ to, from, subject, text, html } or { raw })",
        "multipart/form-data (fields: to, from, subject, text, html, raw)",
      ],
      customHeaders: [
        "X-Inbound-Recipient: recipient@customdomain.com",
        "X-Inbound-Sender: sender@external.com",
      ],
    },
  });
}

/**
 * POST /api/webhooks/inbound
 * Universal Inbound Webhook:
 * Accepts incoming email payloads and proxies to mymail-worker for
 * parsing, Cloudinary raw asset storage, and database ingestion.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.arrayBuffer();

    const headers = new Headers();
    req.headers.forEach((value, key) => {
      // Forward relevant headers while stripping hop-by-hop headers
      const lower = key.toLowerCase();
      if (!["host", "connection", "transfer-encoding", "content-length"].includes(lower)) {
        headers.set(key, value);
      }
    });

    const response = await fetch(WORKER_INBOUND_URL, {
      method: "POST",
      headers,
      body: rawBody,
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("[Inbound Webhook Gateway] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to forward inbound email to worker",
        details: error?.message || String(error),
      },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Inbound-Recipient, X-Inbound-Sender",
    },
  });
}
