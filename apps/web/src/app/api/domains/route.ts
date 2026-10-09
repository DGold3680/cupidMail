import { NextRequest, NextResponse } from "next/server";
import { prisma, VerificationStatus, ServiceStatus, Role } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "runnly.xyz";

/**
 * GET /api/domains
 * Returns all domains with their mailboxes, aliases, and sending configs.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    const whereClause =
      user && user.role !== Role.ADMIN && user.role !== Role.OWNER
        ? {
            OR: [{ ownerId: user.id }, { name: BASE_DOMAIN }],
          }
        : {};

    const domains = await prisma.domain.findMany({
      where: whereClause,
      include: {
        mailboxes: {
          select: {
            id: true,
            localPart: true,
            address: true,
            displayName: true,
            status: true,
          },
        },
        aliases: {
          select: {
            id: true,
            address: true,
            targetMailboxId: true,
            enabled: true,
          },
        },
        sendingConfig: {
          include: {
            providerConnection: {
              select: {
                id: true,
                name: true,
                provider: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ domains, baseDomain: BASE_DOMAIN });
  } catch (error: any) {
    console.error("Error fetching domains:", error);
    return NextResponse.json(
      { error: "Failed to fetch domains", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/domains
 * Adds a new custom domain with PENDING status (not auto-verified).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Domain name is required" }, { status: 400 });
    }

    const domainName = name.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    // Validate domain format
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
    if (!domainRegex.test(domainName)) {
      return NextResponse.json({ error: "Invalid domain format (e.g. example.com)" }, { status: 400 });
    }

    // Get current authenticated user or fallback
    let user = await getSessionUser(req);
    if (!user) {
      user = await prisma.user.findFirst();
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: "00000000-0000-0000-0000-000000000001",
            email: "adsconversionng@gmail.com",
            name: "Cupid Admin",
            role: Role.ADMIN,
          },
        });
      }
    }

    // Required DNS records template
    const requiredDnsRecords = [
      {
        type: "MX",
        name: "@",
        value: "route1.mx.cloudflare.net",
        priority: 10,
        purpose: "Cloudflare Email Routing (Inbound - Priority 10)",
      },
      {
        type: "MX",
        name: "@",
        value: "route2.mx.cloudflare.net",
        priority: 20,
        purpose: "Cloudflare Email Routing (Inbound - Priority 20)",
      },
      {
        type: "MX",
        name: "@",
        value: "route3.mx.cloudflare.net",
        priority: 30,
        purpose: "Cloudflare Email Routing (Inbound - Priority 30)",
      },
      {
        type: "TXT",
        name: "@",
        value: "v=spf1 include:_spf.mx.cloudflare.net include:resend.com ~all",
        purpose: "SPF (Inbound Routing & Resend Outbound)",
      },
      {
        type: "TXT",
        name: "_dmarc",
        value: "v=DMARC1; p=none;",
        purpose: "DMARC Protection Policy",
      },
      {
        type: "TXT",
        name: "resend._domainkey",
        value: "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ... (copy from Resend dashboard)",
        purpose: "DKIM Key (Outbound Signing)",
      },
    ];

    // New custom domains start as PENDING with INACTIVE services until DNS is verified
    const isBaseDomain = domainName === BASE_DOMAIN;
    const domain = await prisma.domain.create({
      data: {
        name: domainName,
        ownerId: user.id,
        verificationStatus: isBaseDomain ? VerificationStatus.VERIFIED : VerificationStatus.PENDING,
        inboundStatus: isBaseDomain ? ServiceStatus.ACTIVE : ServiceStatus.INACTIVE,
        outboundStatus: isBaseDomain ? ServiceStatus.ACTIVE : ServiceStatus.INACTIVE,
        dnsRecords: requiredDnsRecords,
      },
    });

    return NextResponse.json({
      success: true,
      domain,
      dnsRecords: requiredDnsRecords,
    });
  } catch (error: any) {
    console.error("Error creating domain:", error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Domain already exists" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Failed to create domain", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/domains
 * Verifies DNS records for a domain via Cloudflare DNS-over-HTTPS.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: "Domain ID is required" }, { status: 400 });
    }

    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    if (action === "verify") {
      // Query Cloudflare DNS-over-HTTPS for MX and TXT records
      let mxVerified = false;
      let spfVerified = false;
      let detectedMx: string[] = [];
      let detectedTxt: string[] = [];

      try {
        const mxRes = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain.name)}&type=MX`,
          {
            headers: { accept: "application/dns-json" },
            cache: "no-store",
          }
        );
        const mxData = await mxRes.json();
        if (mxData?.Answer && Array.isArray(mxData.Answer)) {
          detectedMx = mxData.Answer.map((a: any) => String(a.data || "").toLowerCase());
          // Look for Cloudflare email routing MX servers
          mxVerified = detectedMx.some(
            (d) =>
              d.includes("cloudflare.net") ||
              d.includes("route1.mx") ||
              d.includes("route2.mx") ||
              d.includes("route3.mx")
          );
        }
      } catch (e) {
        console.warn("Error querying MX records:", e);
      }

      try {
        const txtRes = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain.name)}&type=TXT`,
          {
            headers: { accept: "application/dns-json" },
            cache: "no-store",
          }
        );
        const txtData = await txtRes.json();
        if (txtData?.Answer && Array.isArray(txtData.Answer)) {
          detectedTxt = txtData.Answer.map((a: any) => String(a.data || "").toLowerCase());
          spfVerified = detectedTxt.some((t) => t.includes("v=spf1"));
        }
      } catch (e) {
        console.warn("Error querying TXT records:", e);
      }

      if (mxVerified) {
        const updated = await prisma.domain.update({
          where: { id: domain.id },
          data: {
            verificationStatus: VerificationStatus.VERIFIED,
            inboundStatus: ServiceStatus.ACTIVE,
            outboundStatus: spfVerified ? ServiceStatus.ACTIVE : domain.outboundStatus,
          },
        });

        return NextResponse.json({
          success: true,
          verified: true,
          domain: updated,
          message: "Domain MX records verified successfully!",
          detectedMx,
        });
      } else {
        return NextResponse.json({
          success: false,
          verified: false,
          domain,
          message:
            "Cloudflare Email Routing MX records not yet detected. If you just added them, please allow 1-2 minutes for DNS propagation.",
          detectedMx,
        });
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Error verifying domain:", error);
    return NextResponse.json(
      { error: "Failed to verify domain", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/domains
 * Deletes a custom domain (base domain protected).
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch (e) {}
    }

    if (!id) {
      return NextResponse.json({ error: "Domain ID is required" }, { status: 400 });
    }

    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    if (domain.name === BASE_DOMAIN) {
      return NextResponse.json(
        { error: "Cannot delete the platform base domain" },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser(req);
    if (sessionUser && sessionUser.role !== Role.ADMIN && sessionUser.role !== Role.OWNER) {
      if (domain.ownerId !== sessionUser.id) {
        return NextResponse.json(
          { error: "You are not authorized to delete this domain" },
          { status: 403 }
        );
      }
    }

    // Cascade delete mailboxes, aliases, configs
    const mailboxes = await prisma.mailbox.findMany({
      where: { domainId: domain.id },
      select: { id: true },
    });
    const mbIds = mailboxes.map((m) => m.id);

    await prisma.mailboxMessage.deleteMany({
      where: { mailboxId: { in: mbIds } },
    });
    await prisma.alias.deleteMany({
      where: { domainId: domain.id },
    });
    await prisma.mailboxMember.deleteMany({
      where: { mailboxId: { in: mbIds } },
    });
    await prisma.mailbox.deleteMany({
      where: { domainId: domain.id },
    });
    await prisma.domainSendingConfig.deleteMany({
      where: { domainId: domain.id },
    });
    await prisma.domain.delete({
      where: { id: domain.id },
    });

    return NextResponse.json({
      success: true,
      message: `Domain ${domain.name} removed successfully`,
    });
  } catch (error: any) {
    console.error("Error deleting domain:", error);
    return NextResponse.json(
      { error: "Failed to delete domain", details: error?.message },
      { status: 500 }
    );
  }
}
