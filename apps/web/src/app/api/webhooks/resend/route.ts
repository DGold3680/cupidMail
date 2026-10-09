import { NextRequest, NextResponse } from "next/server";
import { prisma, DeliveryStatus } from "@mymail/database";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend
 * Webhook handler for Resend email delivery notifications
 */
export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    const { type, data } = event;
    const providerMessageId = data?.email_id;

    if (!providerMessageId) {
      return NextResponse.json({ received: true });
    }

    let status: DeliveryStatus | null = null;
    let lastError: string | null = null;

    switch (type) {
      case "email.sent":
      case "email.delivered":
        status = DeliveryStatus.DELIVERED;
        break;
      case "email.bounced":
        status = DeliveryStatus.BOUNCED;
        lastError = data?.bounce?.message || "Email bounced";
        break;
      case "email.complained":
        status = DeliveryStatus.COMPLAINED;
        lastError = "Spam complaint received";
        break;
      case "email.failed":
        status = DeliveryStatus.FAILED;
        lastError = data?.error || "Delivery failed";
        break;
    }

    if (status) {
      await prisma.outgoingDelivery.updateMany({
        where: { providerMessageId },
        data: {
          status,
          lastError,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Resend webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing error", details: error?.message },
      { status: 500 }
    );
  }
}
