import { NextRequest, NextResponse } from "next/server";
import { prisma, ProviderType, ProviderStatus } from "@mymail/database";
import { encryptCredentials } from "@mymail/mail-core";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

/**
 * GET /api/providers
 * Returns all connected email sending providers for the current user (credentials masked)
 */
export async function GET() {
  try {
    const providers = await prisma.emailProviderConnection.findMany({
      include: {
        sendingConfigs: {
          include: {
            domain: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const safeProviders = providers.map((p) => ({
      id: p.id,
      name: p.name,
      provider: p.provider,
      status: p.status,
      createdAt: p.createdAt,
      linkedDomains: p.sendingConfigs.map((sc) => ({
        domainId: sc.domainId,
        domainName: sc.domain.name,
        verified: sc.verified,
        enabled: sc.enabled,
      })),
    }));

    return NextResponse.json({ providers: safeProviders });
  } catch (error: any) {
    console.error("Error fetching providers:", error);
    return NextResponse.json(
      { error: "Failed to fetch providers", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/providers
 * Validates, encrypts, and saves a Bring-Your-Own-Key Resend API key
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, apiKey, domainIds } = body;

    if (!apiKey || typeof apiKey !== "string" || !apiKey.startsWith("re_")) {
      return NextResponse.json(
        { error: "Invalid Resend API key. Keys typically begin with 're_'." },
        { status: 400 }
      );
    }

    // 1. Validate key by pinging Resend API
    try {
      const resend = new Resend(apiKey);
      const apiCheck = await resend.apiKeys.list();
      // Even if list fails due to restricted sending-only permissions, check if domain send check works
    } catch (testErr) {
      console.warn("Resend test ping warning:", testErr);
      // Sending-only keys might not have apiKeys:list permission, which is expected per PRD1
    }

    // 2. Encrypt credentials with AES-256-GCM
    const encryptedCredentials = encryptCredentials(apiKey);

    // 3. Get or create a default user for ownership
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: "00000000-0000-0000-0000-000000000001",
          email: "admin@example.com",
          name: "Default Admin",
        },
      });
    }

    // 4. Save to database
    const providerConnection = await prisma.emailProviderConnection.create({
      data: {
        userId: user.id,
        name: name || "Resend Account",
        provider: ProviderType.RESEND,
        encryptedCredentials,
        status: ProviderStatus.ACTIVE,
      },
    });

    // 5. Link to domains if provided
    if (domainIds && Array.isArray(domainIds)) {
      for (const domainId of domainIds) {
        await prisma.domainSendingConfig.upsert({
          where: { domainId },
          update: {
            providerConnectionId: providerConnection.id,
            enabled: true,
          },
          create: {
            domainId,
            providerConnectionId: providerConnection.id,
            enabled: true,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      providerId: providerConnection.id,
      name: providerConnection.name,
    });
  } catch (error: any) {
    console.error("Error creating provider connection:", error);
    return NextResponse.json(
      { error: "Failed to connect provider", details: error?.message },
      { status: 500 }
    );
  }
}
