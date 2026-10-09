import crypto from "crypto";
import { prisma, Role, VerificationStatus, ServiceStatus, MailFolder, MessageDirection, RecipientType } from "./index";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

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

  // 2. Create or update base admin user (adsconversionng@gmail.com / 1234567890)
  const adminEmail = "adsconversionng@gmail.com";
  const adminPassword = "1234567890";
  const adminPasswordHash = hashPassword(adminPassword);

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: adminEmail },
        { email: "admin@runnly.xyz" },
      ],
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: "00000000-0000-0000-0000-000000000001",
        email: adminEmail,
        name: "Cupid Admin",
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
        avatarUrl: "/assets/Logo.png",
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: adminEmail,
        name: "Cupid Admin",
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
        avatarUrl: "/assets/Logo.png",
      },
    });
  }

  console.log(`Base Admin User configured: ${user.email} (password seeded)`);

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

  // 5. Welcome Email in admin@runnly.xyz (create or update to Cupid Mail deep red theme)
  const welcomeSnippet = "Welcome to Cupid Mail! Your private serverless email platform is configured and ready.";
  const welcomeSubject = "Welcome to Cupid Mail on runnly.xyz!";
  const welcomeText = `Welcome to Cupid Mail on runnly.xyz!

Your private, serverless email platform is configured and ready:
- Active Domain: runnly.xyz
- Cloudflare Email Routing: Ready to receive on *@runnly.xyz
- Storage: Cloudinary Raw Assets (.eml & attachments)
- Outbound Sending: Resend (BYOK)
- Web UI: Cupid Mail (Deep Red & Cream White)

Enjoy your private serverless inbox!`;

  const welcomeHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Space Mono', sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; background: #FAF7F2; border-radius: 16px; overflow: hidden; border: 1px solid #ECE3D6; box-shadow: 0 4px 20px -2px rgba(136, 19, 55, 0.08);">
  <!-- Header with Deep Red and Cupid Logo -->
  <div style="background: linear-gradient(135deg, #881337 0%, #4c0519 100%); padding: 32px 28px; color: #FFFDFB; text-align: left; border-bottom: 3px solid #be123c;">
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
      <tr>
        <td style="vertical-align: middle; padding-right: 14px;">
          <img src="/assets/Logo.png" alt="Cupid Mail" style="width: 48px; height: 48px; object-fit: contain; display: block; background: rgba(255, 255, 255, 0.12); padding: 5px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.25);" />
        </td>
        <td style="vertical-align: middle;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #fecdd3; font-weight: 700;">Cupid Mail Platform</div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFDFB; letter-spacing: -0.02em;">Welcome to Cupid Mail!</h1>
        </td>
      </tr>
    </table>
    <p style="margin: 0; color: #ffe4e6; font-size: 14px; opacity: 0.95;">Your private, serverless email platform on runnly.xyz is configured and ready.</p>
  </div>

  <!-- Content Body in Cream White -->
  <div style="background: #FFFDFB; padding: 28px; border-radius: 0 0 16px 16px;">
    <p style="font-size: 15px; margin-top: 0; color: #292524;">
      Hello! Your domain <strong style="color: #881337;">runnly.xyz</strong> is live and receiving emails with serverless routing.
    </p>

    <!-- Highlight Card -->
    <div style="background: #FFF1F2; border: 1px solid #FFE4E6; border-left: 4px solid #881337; padding: 18px 20px; margin: 20px 0; border-radius: 10px;">
      <strong style="color: #881337; font-size: 14px; display: block; margin-bottom: 8px;">Architecture Highlights:</strong>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #44403c; line-height: 1.8;">
        <li><strong>Active Domain:</strong> <code style="font-family: monospace; background: #FFE4E6; color: #881337; padding: 2px 6px; border-radius: 4px;">runnly.xyz</code></li>
        <li><strong>Inbound Routing:</strong> Cloudflare Email Routing &rarr; Cloudflare Worker</li>
        <li><strong>Raw Storage:</strong> Cloudinary Raw Assets (.eml &amp; attachments)</li>
        <li><strong>Outbound Sending:</strong> Resend BYOK</li>
        <li><strong>Client UI:</strong> Cupid Mail (Deep Red &amp; Cream White)</li>
      </ul>
    </div>

    <p style="font-size: 13px; color: #78716c; line-height: 1.6; margin-bottom: 0;">
      You can now add custom domains, configure storage credentials, or compose your first letter from the sidebar.
    </p>
  </div>
</div>`;

  const existingWelcome = await prisma.mailboxMessage.findFirst({
    where: { mailboxId: adminRunnly.id },
  });

  if (!existingWelcome) {
    const thread = await prisma.thread.create({
      data: {
        subjectNormalized: "welcome to cupid mail",
        snippet: welcomeSnippet,
        lastMessageAt: new Date(),
        messageCount: 1,
      },
    });

    const welcomeMessage = await prisma.message.create({
      data: {
        threadId: thread.id,
        fromAddress: "system@runnly.xyz",
        fromName: "Runnly System",
        subject: welcomeSubject,
        textBody: welcomeText,
        htmlBody: welcomeHtml,
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
  } else {
    // Update existing welcome message and thread to the new Cupid Mail design
    const updatedMsg = await prisma.message.update({
      where: { id: existingWelcome.messageId },
      data: {
        fromName: "Runnly System",
        fromAddress: "system@runnly.xyz",
        subject: welcomeSubject,
        textBody: welcomeText,
        htmlBody: welcomeHtml,
      },
    });

    await prisma.thread.update({
      where: { id: updatedMsg.threadId },
      data: {
        snippet: welcomeSnippet,
        subjectNormalized: "welcome to cupid mail",
      },
    });
  }

  // Update any other existing messages from system@runnly.xyz or with "Welcome" in subject
  await prisma.message.updateMany({
    where: {
      OR: [
        { fromAddress: "system@runnly.xyz" },
        { subject: { contains: "Welcome" } },
      ],
    },
    data: {
      fromName: "Runnly System",
      fromAddress: "system@runnly.xyz",
      subject: welcomeSubject,
      textBody: welcomeText,
      htmlBody: welcomeHtml,
    },
  });

  const allSystemMsgs = await prisma.message.findMany({
    where: { fromAddress: "system@runnly.xyz" },
    select: { threadId: true },
  });
  for (const m of allSystemMsgs) {
    await prisma.thread.update({
      where: { id: m.threadId },
      data: {
        snippet: welcomeSnippet,
        subjectNormalized: "welcome to cupid mail",
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
