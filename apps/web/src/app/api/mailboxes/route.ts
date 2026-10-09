import { NextRequest, NextResponse } from "next/server";
import { prisma, MailboxStatus, Role } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "runnly.xyz";

/**
 * GET /api/mailboxes
 * Returns all active mailboxes and aliases grouped by domain
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    const whereClause: any = { status: MailboxStatus.ACTIVE };

    if (user && user.role !== Role.ADMIN && user.role !== Role.OWNER) {
      whereClause.OR = [
        { domain: { ownerId: user.id } },
        { members: { some: { userId: user.id } } },
        { domain: { name: BASE_DOMAIN } },
      ];
    }

    const mailboxes = await prisma.mailbox.findMany({
      where: whereClause,
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

    let user = await getSessionUser(req);
    if (!user) {
      user = await prisma.user.findFirst();
    }
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== Role.ADMIN && user.role !== Role.OWNER && domain.ownerId !== user.id) {
      return NextResponse.json(
        { error: "You are not authorized to create mailboxes on this domain" },
        { status: 403 }
      );
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

    const serializedMailbox = {
      ...mailbox,
      quotaBytes: Number(mailbox.quotaBytes),
      usedBytes: Number(mailbox.usedBytes),
    };

    return NextResponse.json({ success: true, mailbox: serializedMailbox });
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
