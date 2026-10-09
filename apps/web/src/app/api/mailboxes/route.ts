import { NextRequest, NextResponse } from "next/server";
import { prisma, MailboxStatus, Role } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mailboxes
 * Returns all active mailboxes and aliases grouped by domain
 */
export async function GET() {
  try {
    const mailboxes = await prisma.mailbox.findMany({
      where: { status: MailboxStatus.ACTIVE },
      include: {
        domain: {
          select: { id: true, name: true },
        },
        aliases: {
          where: { enabled: true },
          select: { id: true, address: true },
        },
      },
      orderBy: { address: "asc" },
    });

    const serializedMailboxes = mailboxes.map((mb) => ({
      ...mb,
      quotaBytes: Number(mb.quotaBytes),
      usedBytes: Number(mb.usedBytes),
    }));

    return NextResponse.json({ mailboxes: serializedMailboxes });
  } catch (error: any) {
    console.error("Error fetching mailboxes:", error);
    return NextResponse.json(
      { error: "Failed to fetch mailboxes", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mailboxes
 * Creates a new mailbox or alias for a domain
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, domainId, localPart, displayName, targetMailboxId } = body;

    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const cleanLocalPart = localPart.toLowerCase().trim();
    const fullAddress = `${cleanLocalPart}@${domain.name}`;

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

    if (type === "alias") {
      if (!targetMailboxId) {
        return NextResponse.json(
          { error: "targetMailboxId is required for aliases" },
          { status: 400 }
        );
      }

      const alias = await prisma.alias.create({
        data: {
          domainId: domain.id,
          address: fullAddress,
          targetMailboxId,
          enabled: true,
        },
      });

      return NextResponse.json({ success: true, alias });
    }

    // Default: create mailbox
    const mailbox = await prisma.mailbox.create({
      data: {
        domainId: domain.id,
        localPart: cleanLocalPart,
        address: fullAddress,
        displayName: displayName || cleanLocalPart,
        status: MailboxStatus.ACTIVE,
      },
    });

    // Add user as owner of mailbox
    await prisma.mailboxMember.create({
      data: {
        mailboxId: mailbox.id,
        userId: user.id,
        role: Role.OWNER,
      },
    });

    return NextResponse.json({ success: true, mailbox });
  } catch (error: any) {
    console.error("Error creating mailbox/alias:", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Email address or alias already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create mailbox", details: error?.message },
      { status: 500 }
    );
  }
}
