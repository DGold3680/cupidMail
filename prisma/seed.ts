import { prisma, Role, VerificationStatus, ServiceStatus, MailFolder, MessageDirection, RecipientType } from "./index";

async function main() {
  console.log("Cleaning up jambacademy.com and reseeding for runnly.xyz...");

  // 1. Remove jambacademy.com if it exists
  const jambDomain = await prisma.domain.findUnique({
    where: { name: "jambacademy.com" },
  });

  if (jambDomain) {
    // Delete mailbox messages, mailboxes, aliases for jambacademy
    const jambMailboxes = await prisma.mailbox.findMany({
      where: { domainId: jambDomain.id },
      select: { id: true },
    });
    const mbIds = jambMailboxes.map((m) => m.id);

    await prisma.mailboxMessage.deleteMany({
      where: { mailboxId: { in: mbIds } },
    });
    await prisma.alias.deleteMany({
      where: { domainId: jambDomain.id },
    });
    await prisma.mailboxMember.deleteMany({
      where: { mailboxId: { in: mbIds } },
    });
    await prisma.mailbox.deleteMany({
      where: { domainId: jambDomain.id },
    });
    await prisma.domainSendingConfig.deleteMany({
      where: { domainId: jambDomain.id },
    });
    await prisma.domain.delete({
      where: { id: jambDomain.id },
    });
    console.log("Successfully removed jambacademy.com and its associated records.");
  }

  // 2. Create or update default admin user for runnly.xyz
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "admin@runnly.xyz",
        name: "Runnly Admin",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Runnly",
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: "admin@runnly.xyz",
        name: "Runnly Admin",
      },
    });
  }

  console.log(`User created/updated: ${user.email}`);

  // 3. Configure Active Base Domain: runnly.xyz
  const domainRunnly = await prisma.domain.upsert({
    where: { name: "runnly.xyz" },
    update: {
      verificationStatus: VerificationStatus.VERIFIED,
      inboundStatus: ServiceStatus.ACTIVE,
      outboundStatus: ServiceStatus.ACTIVE,
    },
    create: {
      name: "runnly.xyz",
      ownerId: user.id,
      verificationStatus: VerificationStatus.VERIFIED,
      inboundStatus: ServiceStatus.ACTIVE,
      outboundStatus: ServiceStatus.ACTIVE,
    },
  });

  console.log(`Domain configured: ${domainRunnly.name}`);

  // 4. Mailboxes for runnly.xyz
  const adminRunnly = await prisma.mailbox.upsert({
    where: { address: "admin@runnly.xyz" },
    update: {
      domainId: domainRunnly.id,
      displayName: "Runnly Admin",
    },
    create: {
      domainId: domainRunnly.id,
      localPart: "admin",
      address: "admin@runnly.xyz",
      displayName: "Runnly Admin",
    },
  });

  const supportRunnly = await prisma.mailbox.upsert({
    where: { address: "support@runnly.xyz" },
    update: {
      domainId: domainRunnly.id,
      displayName: "Runnly Support",
    },
    create: {
      domainId: domainRunnly.id,
      localPart: "support",
      address: "support@runnly.xyz",
      displayName: "Runnly Support",
    },
  });

  const helloRunnly = await prisma.mailbox.upsert({
    where: { address: "hello@runnly.xyz" },
    update: {
      domainId: domainRunnly.id,
      displayName: "Hello Runnly",
    },
    create: {
      domainId: domainRunnly.id,
      localPart: "hello",
      address: "hello@runnly.xyz",
      displayName: "Hello Runnly",
    },
  });

  // Link mailbox memberships
  for (const mb of [adminRunnly, supportRunnly, helloRunnly]) {
    await prisma.mailboxMember.upsert({
      where: {
        mailboxId_userId: {
          mailboxId: mb.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        mailboxId: mb.id,
        userId: user.id,
        role: Role.OWNER,
      },
    });
  }

  // Alias: contact@runnly.xyz -> hello@runnly.xyz
  await prisma.alias.upsert({
    where: { address: "contact@runnly.xyz" },
    update: {
      targetMailboxId: helloRunnly.id,
      enabled: true,
    },
    create: {
      domainId: domainRunnly.id,
      address: "contact@runnly.xyz",
      targetMailboxId: helloRunnly.id,
      enabled: true,
    },
  });

  // 5. Welcome Email in admin@runnly.xyz (if not already existing)
  const existingWelcome = await prisma.mailboxMessage.findFirst({
    where: { mailboxId: adminRunnly.id },
  });

  if (!existingWelcome) {
    const thread = await prisma.thread.create({
      data: {
        subjectNormalized: "welcome to runnly email platform",
        snippet: "Welcome to your serverless email on runnly.xyz! Cloudflare + Cloudinary + Resend are connected.",
        lastMessageAt: new Date(),
        messageCount: 1,
      },
    });

    const welcomeMessage = await prisma.message.create({
      data: {
        threadId: thread.id,
        fromAddress: "system@runnly.xyz",
        fromName: "Runnly System",
        subject: "Welcome to your serverless email on runnly.xyz!",
        textBody: `Welcome to Mymail on runnly.xyz!

Your serverless email hosting platform is configured and ready:
- Active Domain: runnly.xyz
- Cloudflare Email Routing: Ready to receive on *@runnly.xyz
- Storage: Cloudinary Raw Assets (.eml & attachments)
- Outbound: Resend (BYOK)
- Web UI: Next.js on Vercel

Enjoy your private serverless inbox!`,
        htmlBody: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px;">
        <div style="background: #0d9488; padding: 24px; border-radius: 12px 12px 0 0; color: white;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Welcome to runnly.xyz!</h1>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Your private, serverless email platform is ready.</p>
        </div>
        <div style="background: white; border: 1px solid #ccfbf1; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
          <p>Your platform is ready to route emails with Cloudflare and Cloudinary.</p>
          <div style="background: #f0fdfa; border-left: 4px solid #0d9488; padding: 14px 16px; margin: 16px 0; border-radius: 4px;">
            <strong style="color: #0f766e;">Configuration Highlights:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #334155;">
              <li><strong>Domain:</strong> runnly.xyz</li>
              <li><strong>Inbound Routing:</strong> Cloudflare Email Routing &rarr; Cloudflare Worker</li>
              <li><strong>Raw Storage:</strong> Cloudinary Raw Assets</li>
              <li><strong>Outbound Sending:</strong> Resend BYOK</li>
            </ul>
          </div>
          <p style="font-size: 13px; color: #64748b;">Ready to test adding new custom domains (like jambacademy.com)!</p>
        </div>
      </div>`,
        direction: MessageDirection.INBOUND,
        receivedAt: new Date(),
      },
    });

    await prisma.messageRecipient.create({
      data: {
        messageId: welcomeMessage.id,
        address: "admin@runnly.xyz",
        name: "Runnly Admin",
        recipientType: RecipientType.TO,
      },
    });

    await prisma.mailboxMessage.create({
      data: {
        mailboxId: adminRunnly.id,
        messageId: welcomeMessage.id,
        folder: MailFolder.INBOX,
        isRead: false,
        isStarred: true,
      },
    });
  }

  console.log("Seeding completed successfully! Active domain is runnly.xyz.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
