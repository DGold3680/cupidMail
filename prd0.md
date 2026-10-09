We'll document this as a technical architecture and implementation plan for a **self-hosted, multi-domain email platform that requires no traditional server**.

I'm making one addition to our earlier design: **Cloudflare R2 and Cloudflare Queues**. These allow us to handle incoming emails reliably, process them asynchronously, and store attachments without running EC2, a VPS, or a persistent background worker.

# Custom Multi-Domain Email Hosting Platform
**Technical Architecture & Implementation Plan — Version 1.0**


## 1. Project Overview

### 1.1 Vision

Build a private, lightweight email hosting platform capable of managing multiple custom-domain email addresses through a single web application.

The platform will provide functionality similar to traditional email hosting services such as Gmail, Zoho Mail, and Outlook, while retaining full control over mailbox management, message storage, and the user interface.

The system will be entirely serverless, eliminating the need to maintain SMTP servers, IMAP servers, virtual machines, or dedicated background-processing infrastructure.

### 1.2 Primary Objectives

1. Support multiple custom domains under one application.
2. Allow multiple email addresses and aliases per domain.
3. Receive emails using Cloudflare Email Routing.
4. Process incoming emails using Cloudflare Workers.
5. Store email metadata and content in Supabase PostgreSQL.
6. Store raw emails and attachments in Cloudflare R2.
7. Send outgoing emails using Resend.
8. Provide a modern webmail interface built with Next.js.
9. Support unified and individual mailbox views.
10. Support multiple users and mailbox access permissions.
11. Minimize recurring infrastructure costs.
12. Ensure reliable delivery, processing, storage, and retrieval.

### 1.3 Scope

**Initial release**

The first release will be a private email hosting platform for domains controlled by the application owner.

It will support:

- Custom-domain configuration.
- Mailbox and alias creation.
- Incoming email reception.
- Outgoing email delivery.
- Email threading.
- Inbox management.
- Email attachments.
- Email search.
- Multiple sender identities.
- User authentication.
- Basic mailbox permissions.
- Responsive webmail.

**Outside the initial scope**

- Public email hosting registration.
- Subscription billing.
- Native IMAP or POP3.
- Traditional SMTP submission for third-party clients.
- Native mobile applications.
- Advanced spam classification.
- Enterprise administration features.

The architecture should permit adding these capabilities later.

---

# 2. Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js + React | Webmail interface |
| Hosting | Vercel | Frontend and backend API hosting |
| Authentication | Supabase Auth | User authentication |
| Database | Supabase PostgreSQL | Structured email storage |
| ORM | Prisma | Database access and migrations |
| Incoming transport | Cloudflare Email Routing | Receive emails |
| Incoming processing | Cloudflare Workers | Email ingestion and processing |
| Background jobs | Cloudflare Queues | Asynchronous message processing |
| Object storage | Cloudflare R2 | Raw MIME emails and attachments |
| Outgoing transport | Resend | Send emails |
| Realtime updates | Supabase Realtime | Mailbox notifications |
| DNS | Cloudflare DNS | Domain and email routing configuration |

## 2.1 Why this stack?

The selected technologies complement one another.

Cloudflare handles inbound email traffic and edge processing.

Supabase provides authentication, structured storage, and realtime updates.

Vercel hosts the user-facing application.

Resend handles outgoing delivery, removing the need to maintain SMTP sending infrastructure.

Most importantly, **no dedicated server is required, including for background jobs**.

Cloudflare Queue consumers execute as serverless Workers automatically when messages become available.

---

# 3. High-Level Architecture

```text
                     INTERNET
                        |
           +------------+------------+
           |            |            |
           v            v            v
       domain1.com  domain2.com  domain3.com
           |            |            |
           +------------+------------+
                        |
                        v
                CLOUDFLARE DNS
                        |
                        v
              CLOUDFLARE EMAIL
                   ROUTING
                        |
                        v
                EMAIL INGESTION
                    WORKER
                        |
                        v
                 CLOUDFLARE R2
                 Raw MIME Storage
                        |
                        v
                 CLOUDFLARE QUEUE
                        |
                        v
                 PROCESSING WORKER
                        |
             +----------+----------+
             |                     |
             v                     v
      SUPABASE POSTGRES       CLOUDFLARE R2
      Message metadata        Attachments
      Mailbox records
      Thread records
             |
             v
        SUPABASE API
             |
             v
        NEXT.JS BACKEND
             |
             v
         NEXT.JS UI
          (VERCEL)
             |
             v
         EMAIL USER
             |
             |
        Compose / Reply
             |
             v
         NEXT.JS API
             |
             v
           RESEND
             |
             v
       RECIPIENT SERVER
```

The architecture separates incoming delivery, processing, storage, presentation, and outgoing delivery.

This separation improves reliability and allows individual components to scale independently.

---

# 4. Email Receiving Architecture

## 4.1 Cloudflare Email Routing

Cloudflare will act as the incoming email transport provider.

Each managed domain must have Cloudflare Email Routing configured.

For example:

```text
support@domain1.com
hello@domain2.com
admin@domain3.com
```

All three addresses can route to the same Cloudflare Worker.

Cloudflare receives incoming SMTP connections and invokes the Worker's `email()` handler.

This eliminates the need to operate Postfix, Haraka, or another SMTP server.

### Domain requirements

Each domain must:

1. Be configured to use Cloudflare DNS.
2. Have Cloudflare Email Routing enabled.
3. Have the necessary MX records.
4. Have an active routing rule directing mail to the Worker.

### Routing strategy

The preferred architecture uses one ingestion Worker across all managed domains.

Each domain can use a catch-all routing rule:

```text
*@domain1.com → Email Worker
*@domain2.com → Email Worker
*@domain3.com → Email Worker
```

The Worker determines whether the destination corresponds to a valid mailbox or alias.

**Catch-all routing does not imply catch-all acceptance.**

Unless explicitly enabled, emails addressed to nonexistent mailboxes must be rejected.

This prevents arbitrary addresses from filling the database with unwanted messages.

## 4.2 Cloudflare Worker: Ingestion

The ingestion Worker has a deliberately limited responsibility.

It should:

1. Receive the incoming email.
2. Identify the envelope sender and recipient.
3. Validate the recipient against registered mailboxes and aliases.
4. Enforce message-size and basic acceptance policies.
5. Generate a unique ingestion identifier.
6. Store the complete original email in Cloudflare R2.
7. Publish a processing event to Cloudflare Queues.

The Worker should not perform expensive parsing, attachment extraction, or database transformations.

These operations are handled asynchronously.

### Ingestion pseudocode

```typescript
export default {
  async email(message, env, ctx) {
    const recipient = message.to.toLowerCase();

    // 1. Validate recipient
    const valid = await validateRecipient(
      recipient,
      env
    );

    if (!valid) {
      message.setReject("Unknown recipient");
      return;
    }

    // 2. Generate unique ingestion ID
    const id = crypto.randomUUID();

    // 3. Store raw email
    const storageKey = `emails/raw/${id}.eml`;

    await env.EMAIL_STORAGE.put(
      storageKey,
      message.raw
    );

    // 4. Enqueue processing event
    await env.EMAIL_QUEUE.send({
      id,
      storageKey,
      recipient,
      sender: message.from,
      receivedAt: new Date().toISOString()
    });
  }
};
```

This illustrates the intended processing contract; production code will require typed bindings, robust error handling, durable validation, and retry-safe ingestion.

The raw email must be successfully persisted before the Worker considers it accepted.

If queue publication fails after an R2 write succeeds, the original message remains available for recovery.

A scheduled reconciliation process will identify stored messages that were never successfully queued or processed.

### Why save the original email?

Emails contain considerably more information than just a subject and body.

An original MIME message can contain:

- Sender and recipient headers.
- Message-ID.
- References.
- In-Reply-To.
- HTML and plain-text versions.
- Inline images.
- Attachments.
- Authentication headers.
- MIME encoding information.
- Delivery and routing metadata.

Preserving the original message allows future reparsing without information loss.

It also makes debugging and migration much easier.

---

# 5. Background Processing Without a Server

## 5.1 Cloudflare Queues

Cloudflare Queues provides asynchronous processing without requiring a continuously running application.

Once the ingestion Worker stores an email, it publishes a message to a queue.

Example:

```json
{
  "id": "ingestion-uuid",
  "storageKey": "emails/raw/ingestion-uuid.eml",
  "recipient": "support@domain1.com",
  "sender": "student@gmail.com"
}
```

The queue contains only metadata and a reference to the stored email.

The complete email is not placed inside the queue.

This avoids queue message-size limitations and unnecessary duplication.

## 5.2 Queue Consumer Worker

A second Cloudflare Worker consumes queued jobs.

It executes when jobs are available, without a permanently running server.

Its responsibilities include:

1. Retrieve the original message from R2.
2. Parse the MIME contents.
3. Extract sender, recipients, subject, and body.
4. Extract attachments.
5. Identify the target mailbox.
6. Identify or create the appropriate conversation thread.
7. Store attachment objects in R2.
8. Insert structured message records into PostgreSQL.
9. Mark the ingestion job as processed.

### Email parsing

Use a library compatible with Cloudflare Workers, such as `postal-mime`.

Conceptually:

```typescript
import PostalMime from "postal-mime";

const parser = new PostalMime();

const email = await parser.parse(rawEmail);

const parsed = {
  from: email.from,
  to: email.to,
  cc: email.cc,
  subject: email.subject,
  text: email.text,
  html: email.html,
  attachments: email.attachments
};
```

The consumer then persists the structured data.

### Database access

The processing Worker can interact with Supabase through authenticated HTTP APIs or PostgREST RPC functions.

For the initial implementation, a database RPC function is preferable for operations requiring multiple related inserts.

For example:

```text
process_incoming_email(...)
```

This function can atomically create or update:

- Message records.
- Message recipients.
- Thread relationships.
- Mailbox delivery records.
- Ingestion status.

The Cloudflare Worker will call the function using a server-side credential.

Service-role credentials must never reach the browser.

## 5.3 Reliability and retries

The queue uses an at-least-once delivery model.

Therefore, **every processing operation must be idempotent**.

If a Worker crashes during processing, the message can be retried without creating duplicates.

Use a unique ingestion identifier and database uniqueness constraints.

A message should be acknowledged only after all required durable writes succeed.

### Failed processing

```text
QUEUE JOB
    |
    v
PROCESS EMAIL
    |
    +------ Success ------> Acknowledge
    |
    +------ Failure ------> Retry
                              |
                              v
                         Retry Limit
                              |
                              v
                       Dead Letter Queue
                              |
                              v
                         Alert / Repair
```

A dead-letter queue preserves jobs that repeatedly fail processing.

A recovery workflow should periodically inspect failed jobs and reconcile them against R2.

## 5.4 Recovery process

Add a Cloudflare Cron Trigger that performs lightweight reconciliation.

Its responsibilities include:

- Finding accepted messages without completed processing.
- Re-enqueuing recoverable messages.
- Detecting stuck processing states.
- Reporting repeated failures.
- Monitoring object/database inconsistencies.

For efficient reconciliation, maintain an ingestion manifest or durable receipt record.

The system should never depend exclusively on a queue message as the only record that an incoming email exists.

This completes the serverless background-processing design.

---

# 6. Storage Architecture

We will separate structured data from large binary content.

## 6.1 Supabase PostgreSQL

PostgreSQL stores the information needed to query and display messages.

Examples:

- Sender.
- Recipient.
- Subject.
- Plain-text body.
- HTML body.
- Message identifiers.
- Thread identifiers.
- Timestamps.
- Read/unread state.
- Starred state.
- Mailbox associations.
- Delivery status.

## 6.2 Cloudflare R2

R2 stores:

- Original `.eml` messages.
- Attachments.
- Inline images.
- Large binary message content where necessary.

An example storage structure:

```text
mail-storage/
│
├── raw/
│   ├── ingestion-id-1.eml
│   ├── ingestion-id-2.eml
│   └── ingestion-id-3.eml
│
└── attachments/
    ├── message-id-1/
    │   ├── attachment-id-1
    │   └── attachment-id-2
    │
    └── message-id-2/
        └── attachment-id-3
```

Object names should use generated identifiers rather than user-provided filenames.

Original filenames are retained separately in PostgreSQL.

The bucket must remain private.

Attachments are accessed through authenticated application endpoints or short-lived signed URLs.

---

# 7. Database Design

The database must support multiple domains, mailboxes, aliases, users, and conversations.

## 7.1 Core tables

### Users

Managed through Supabase Auth.

Additional application-specific profile information can be stored in a `profiles` table.

### Domains

```text
domains
-------
id
name
owner_id
verification_status
inbound_status
outbound_status
created_at
updated_at
```

Each domain is independently verified and configured.

### Mailboxes

```text
mailboxes
---------
id
domain_id
local_part
address
display_name
status
quota_bytes
created_at
```

Examples:

```text
admin@domain1.com
support@domain1.com
hello@domain2.com
```

Each mailbox belongs to exactly one domain.

Email addresses must be unique.

### Mailbox Members

```text
mailbox_members
---------------
id
mailbox_id
user_id
role
created_at
```

Roles may include:

- Owner.
- Administrator.
- Member.
- Read-only.

This enables shared mailboxes.

### Aliases

```text
aliases
-------
id
domain_id
address
target_mailbox_id
enabled
created_at
```

Example:

```text
help@domain1.com
      |
      v
support@domain1.com
```

Both addresses deliver into the same mailbox.

The original receiving address must be preserved to support correct reply identities.

### Threads

```text
threads
-------
id
subject_normalized
created_at
updated_at
```

Threads group related messages.

Thread resolution should prioritize RFC message relationships rather than relying solely on subject matching.

### Messages

```text
messages
--------
id
ingestion_id
internet_message_id
thread_id
from_address
from_name
subject
text_body
html_body
raw_storage_key
direction
sent_at
received_at
created_at
```

Direction:

```text
INBOUND
OUTBOUND
```

The `internet_message_id` is the email's RFC Message-ID header.

It is distinct from the internal database identifier.

### Message Recipients

```text
message_recipients
------------------
id
message_id
address
recipient_type
```

Recipient types:

```text
TO
CC
BCC
```

For inbound mail, mailbox delivery must use the actual SMTP envelope recipient, not just visible `To` headers.

This is particularly important for aliases and Bcc recipients.

### Mailbox Messages

```text
mailbox_messages
----------------
id
mailbox_id
message_id
folder
is_read
is_starred
is_archived
is_deleted
created_at
```

This join table represents a message's appearance within a particular mailbox.

It prevents read/unread state from being incorrectly shared across users or mailboxes.

### Attachments

```text
attachments
-----------
id
message_id
filename
content_type
size_bytes
storage_key
content_id
is_inline
created_at
```

### Ingestion Jobs

```text
ingestion_jobs
--------------
id
storage_key
recipient
status
attempt_count
last_error
received_at
processed_at
```

Possible statuses:

```text
RECEIVED
QUEUED
PROCESSING
COMPLETED
FAILED
```

The ingestion identifier should be unique to support retry-safe processing.

### Outgoing Deliveries

```text
outgoing_deliveries
-------------------
id
message_id
provider
provider_message_id
status
last_error
created_at
updated_at
```

This table allows tracking Resend delivery events independently from mailbox state.

---

# 8. Multi-Domain Management

## 8.1 Domain ownership

One account can own multiple domains.

```text
USER ACCOUNT
     |
     +--- domain1.com
     |      |
     |      +--- admin@
     |      +--- support@
     |
     +--- domain2.com
     |      |
     |      +--- hello@
     |
     +--- domain3.com
            |
            +--- contact@
```

All domains are managed from one dashboard.

## 8.2 Domain onboarding

The onboarding workflow will be:

1. User adds a domain.
2. The application generates a verification challenge.
3. User verifies domain ownership using DNS.
4. The application confirms the domain is controlled by the user.
5. Cloudflare Email Routing is configured.
6. The domain is assigned to the ingestion Worker.
7. Resend outgoing-domain verification is completed.
8. Domain status becomes active.

For V1, Cloudflare Email Routing rules may be configured manually through the Cloudflare dashboard.

Later, the application can use Cloudflare's API to automate domain routing.

Automated configuration requires tightly scoped Cloudflare API credentials and explicit authorization over the relevant DNS zones.

## 8.3 Address management

Users can:

- Create a mailbox.
- Delete or disable a mailbox.
- Create aliases.
- Assign mailbox members.
- Choose default sender identities.
- Configure mailbox display names.

Mailbox deletion should initially use soft deletion.

Stored messages should not be immediately erased when an address is disabled.

---

# 9. Outgoing Email Architecture

## 9.1 Resend integration

All outgoing messages will be sent through Resend.

The sending workflow:

```text
NEXT.JS COMPOSER
       |
       v
AUTHENTICATED API
       |
       v
VALIDATE SENDER
       |
       v
CREATE OUTBOX RECORD
       |
       v
RESEND API
       |
       v
RECIPIENT SERVER
       |
       v
DELIVERY WEBHOOK
       |
       v
UPDATE POSTGRESQL
```

The application must verify that the authenticated user has permission to send from the selected address.

A user must never be allowed to specify an arbitrary `from` address.

## 9.2 Sending example

```typescript
import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const result = await resend.emails.send({
  from: "support@domain1.com",
  to: ["recipient@gmail.com"],
  subject: "Hello",
  text: "This is a test email."
});
```

Outgoing attachments must be handled according to Resend's supported attachment and message-size limits.

## 9.3 Replies and threading

When replying, the system should preserve:

- The original message identifier.
- `In-Reply-To`.
- `References`.
- Subject.
- Conversation context.

Example:

```text
Original Message-ID:
<abc123@example.com>

Reply In-Reply-To:
<abc123@example.com>
```

The sending-provider integration must support the necessary custom threading headers.

These relationships allow compatible email clients to group messages correctly.

## 9.4 Sending-provider abstraction

Create a provider interface:

```typescript
interface EmailProvider {
  send(input: SendEmailInput): Promise<SendResult>;
}
```

Implement:

```text
ResendProvider
```

Additional providers can be introduced later:

```text
SesProvider
PostmarkProvider
SmtpProvider
```

This avoids permanently coupling the application to Resend.

## 9.5 Outgoing reliability

An outgoing message should be persisted before requesting delivery from Resend.

Use:

```text
DRAFT
   |
   v
QUEUED
   |
   v
SENDING
   |
   +--- ACCEPTED
   |
   +--- FAILED
```

Provider acceptance does not necessarily mean the recipient received the email.

Delivery webhooks should update the status when Resend supplies further information.

Retry logic must avoid sending the same email twice after ambiguous network failures.

Use provider-supported idempotency keys where available.

---

# 10. Webmail Application

## 10.1 Application structure

Next.js will provide both the frontend and the authenticated application API.

Suggested project structure:

```text
mail-platform/
│
├── apps/
│   └── web/
│       ├── app/
│       │   ├── login/
│       │   ├── inbox/
│       │   ├── sent/
│       │   ├── drafts/
│       │   ├── trash/
│       │   ├── settings/
│       │   └── api/
│       │
│       ├── components/
│       └── lib/
│
├── workers/
│   └── mail/
│       ├── src/
│       │   ├── index.ts
│       │   ├── ingestion.ts
│       │   ├── processor.ts
│       │   └── recovery.ts
│       └── wrangler.jsonc
│
├── packages/
│   ├── database/
│   │   └── prisma/
│   ├── mail-core/
│   ├── mail-providers/
│   └── shared/
│
└── package.json
```

A monorepo allows the web application and Cloudflare Worker to share types and validation logic.

## 10.2 Primary interface

The application will contain:

**Navigation**

```text
MAIL
├── All Inboxes
├── Inbox
├── Starred
├── Sent
├── Drafts
├── Archive
├── Spam
└── Trash
```

**Accounts**

```text
ACCOUNTS
├── domain1.com
│   ├── admin@
│   └── support@
│
├── domain2.com
│   └── hello@
│
└── domain3.com
    └── contact@
```

Users should be able to switch between individual mailboxes and a unified inbox.

## 10.3 MVP features

### Inbox

- Paginated message listing.
- Sender name and address.
- Subject preview.
- Message snippet.
- Unread indicators.
- Attachment indicators.
- Received timestamps.

### Message viewer

- HTML and plain-text rendering.
- Thread navigation.
- Attachments.
- Reply.
- Reply all.
- Forward.
- Archive.
- Delete.
- Star.

### Composer

- Sender identity selector.
- Recipient fields.
- Subject.
- Rich-text editor.
- Attachment upload.
- Draft saving.
- Send action.

### Search

Support queries by:

- Sender.
- Recipient.
- Subject.
- Message body.
- Date.
- Mailbox.
- Read/unread status.

Use PostgreSQL full-text search for the initial release.

More advanced search infrastructure is unnecessary at first.

---

# 11. Realtime Email Notifications

Supabase Realtime will notify connected clients when new messages are inserted.

Flow:

```text
INCOMING EMAIL
      |
      v
PROCESSING WORKER
      |
      v
POSTGRES INSERT
      |
      v
SUPABASE REALTIME
      |
      v
NEXT.JS CLIENT
      |
      v
UPDATE INBOX
```

A subscribed client can automatically:

- Update unread counts.
- Insert newly received messages.
- Show notifications.
- Refresh active conversations.

Realtime subscriptions must be scoped to mailboxes the authenticated user can access.

The initial release does not require an external Redis instance or a separate WebSocket server.

---

# 12. Authentication and Security

## 12.1 Authentication

Use Supabase Auth.

Supported sign-in methods may include:

- Email and password.
- Google OAuth.
- Other OAuth providers.

Users authenticate with the application rather than authenticating separately for each email address.

## 12.2 Authorization

Mailbox access should be controlled using membership records.

Every authenticated API request must validate:

1. User identity.
2. Mailbox membership.
3. Required permission.
4. Requested message ownership or accessibility.

Implement Supabase Row Level Security for browser-accessible data.

Privileged Workers and server-side routes must independently enforce authorization boundaries.

## 12.3 Incoming email security

Incoming messages are untrusted input.

The processing pipeline must account for:

- Malformed MIME content.
- Oversized messages.
- Dangerous HTML.
- Malicious links.
- Potentially harmful attachments.
- Spoofed sender addresses.
- Spam.
- Excessively nested MIME structures.
- Duplicate messages.
- Parser resource exhaustion.

HTML content must be sanitized before rendering.

Remote images should be blocked by default or loaded through a controlled proxy.

Attachments must never be executed by the application.

For the MVP, suspicious attachments can be blocked or restricted until antivirus scanning is introduced.

## 12.4 Credential management

Secrets must remain in server-side environments.

Required credentials include:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
RESEND_API_KEY
```

Cloudflare Workers should use encrypted Worker secrets.

Vercel should use protected environment variables.

Browser code must never contain service-role credentials or Resend API keys.

## 12.5 Domain security

The platform must enforce domain ownership.

Users can send only from addresses associated with verified, authorized domains.

Configure SPF, DKIM, and DMARC for outgoing domains according to Resend's instructions.

Cloudflare's inbound MX configuration must coexist with Resend's outbound authentication records.

---

# 13. Reliability and Data Protection

Email storage should be treated as persistent user data rather than disposable application content.

## 13.1 Durability requirements

The system should ensure that:

- Successfully accepted messages have a durable raw copy.
- Parsed messages are recoverable from raw MIME.
- Duplicate queue deliveries do not create duplicate messages.
- Database failures do not silently discard emails.
- Attachment references are validated.
- Failed jobs can be inspected and retried.
- Outgoing delivery attempts can be audited.

## 13.2 Backups

Recommended backup strategy:

**PostgreSQL**

Schedule regular database backups using Supabase-supported backup tools or an external backup process.

**R2**

Maintain a separate backup or replication destination for important message objects.

**Configuration**

Store infrastructure configuration and database migrations in Git.

**Restore testing**

Periodically verify that messages can be reconstructed from database backups and raw MIME storage.

An object in R2 should not be treated as a backup merely because it is durably stored.

## 13.3 Observability

Track:

- Incoming emails received.
- Successfully processed emails.
- Processing failures.
- Queue depth.
- Oldest queued message.
- Dead-letter messages.
- R2 write failures.
- Database failures.
- Outgoing delivery failures.
- Storage consumption.
- Domain verification status.

Set alerts for repeated processing failures and growing queues.

---

# 14. Infrastructure Deployment

## 14.1 Cloudflare

Create:

1. Email Routing configuration for the first domain.
2. One Email Worker.
3. One private R2 bucket.
4. One processing queue.
5. One dead-letter queue.
6. Queue producer and consumer bindings.
7. Optional Cron Trigger for reconciliation.

A single Worker deployment can expose both `email()` and `queue()` handlers.

For the initial release, this is preferable to maintaining multiple Worker projects.

### Example configuration

Illustrative `wrangler.jsonc`:

```jsonc
{
  "name": "custom-mail-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-08",

  "r2_buckets": [
    {
      "binding": "EMAIL_STORAGE",
      "bucket_name": "mail-storage"
    }
  ],

  "queues": {
    "producers": [
      {
        "binding": "EMAIL_QUEUE",
        "queue": "mail-processing"
      }
    ],
    "consumers": [
      {
        "queue": "mail-processing",
        "max_batch_size": 5,
        "max_retries": 5,
        "dead_letter_queue": "mail-processing-dlq"
      }
    ]
  },

  "triggers": {
    "crons": ["*/15 * * * *"]
  }
}
```

Mail routing rules can be configured through the Cloudflare dashboard or Wrangler.

Actual bindings and resource names must match the deployed Cloudflare resources.

## 14.2 Supabase

Provision a Supabase project.

Configure:

- Authentication.
- PostgreSQL schema.
- Row Level Security.
- Database indexes.
- Database functions.
- Realtime subscriptions.
- Backup policies.

Apply database migrations through Prisma.

## 14.3 Vercel

Deploy the Next.js application.

Configure:

- Production domain.
- Supabase environment variables.
- Resend API key.
- Application secrets.
- Deployment environment settings.

Use authenticated Next.js route handlers for application actions.

## 14.4 Resend

For every outgoing domain:

1. Add the domain to Resend.
2. Publish the required DNS records.
3. Verify domain ownership.
4. Configure the application's sender identities.
5. Test outbound email delivery.
6. Configure delivery-status webhooks.

Resend domain limits depend on the selected subscription.

---

# 15. Implementation Roadmap

## Phase 1 — Foundation

**Goal:** Establish the application and database.

Tasks:

- Initialize monorepo.
- Create Next.js application.
- Configure Supabase.
- Set up Prisma.
- Create core database schema.
- Configure Supabase Auth.
- Implement protected application routes.
- Deploy application to Vercel.

**Deliverable:** A working authenticated application with an empty mailbox interface.

## Phase 2 — Incoming Email

**Goal:** Receive and store real emails.

Tasks:

- Configure Cloudflare Email Routing.
- Create R2 bucket.
- Create ingestion Worker.
- Implement recipient validation.
- Store raw MIME messages.
- Configure Cloudflare Queues.
- Implement MIME parsing.
- Store parsed messages in PostgreSQL.
- Extract and store attachments.
- Add processing retries and dead-letter handling.
- Implement recovery reconciliation.

**Deliverable:** Emails sent to a configured domain appear in PostgreSQL and can be retrieved through the application.

## Phase 3 — Webmail Interface

**Goal:** Read and organize messages.

Tasks:

- Implement inbox listing.
- Implement message viewer.
- Support HTML and plain-text messages.
- Implement threading.
- Support attachment downloads.
- Add read/unread state.
- Add archive, trash, and starred features.
- Implement mailbox filtering.
- Add search.

**Deliverable:** Functional read-only webmail.

## Phase 4 — Outgoing Email

**Goal:** Compose and send messages.

Tasks:

- Integrate Resend.
- Implement sender identity validation.
- Build composer.
- Support attachments.
- Implement replies and forwarding.
- Store outgoing messages.
- Implement drafts.
- Configure Resend webhooks.
- Track delivery status.

**Deliverable:** Full two-way email communication.

## Phase 5 — Multi-Domain Management

**Goal:** Support all owned domains.

Tasks:

- Domain onboarding.
- Domain ownership verification.
- Additional Cloudflare routing rules.
- Additional Resend sending domains.
- Mailbox creation.
- Alias management.
- Unified inbox.
- Per-mailbox inbox.
- Sender identity switching.

**Deliverable:** One webmail application serving multiple custom domains.

## Phase 6 — Production Hardening

**Goal:** Make the system dependable for everyday use.

Tasks:

- Spam protection.
- HTML sanitization.
- Attachment security.
- Rate limiting.
- Failure monitoring.
- Backup automation.
- Recovery testing.
- Search optimization.
- Mobile responsiveness.
- PWA support.
- Notification improvements.

**Deliverable:** Production-ready private email hosting platform.

---

# 16. Testing Strategy

## 16.1 Incoming email tests

Verify:

- Valid email reaches the correct mailbox.
- Unknown recipients are rejected.
- Emails from Gmail and Outlook are accepted.
- HTML emails render correctly.
- Plain-text emails render correctly.
- Attachments are preserved.
- Inline images work.
- Multiple recipients are handled.
- Bcc delivery is attributed correctly.
- Duplicate processing does not create duplicate records.
- Queue failures are recoverable.
- Malformed messages are handled safely.

## 16.2 Outgoing email tests

Verify:

- Each domain can send messages.
- Sender authorization is enforced.
- Reply and reply-all work.
- Attachments are delivered.
- Threads are preserved.
- Failed sends display appropriate errors.
- Delivery webhooks update message status.
- Provider retries do not cause unintended duplicate sends.

## 16.3 Security tests

Verify:

- Users cannot access unauthorized mailboxes.
- R2 objects are private.
- Service-role credentials are never exposed.
- HTML sanitization works.
- Malicious attachments are handled safely.
- Unauthenticated API requests fail.
- Arbitrary sender addresses cannot be used.

## 16.4 Recovery tests

Simulate:

- Supabase unavailable.
- R2 temporarily unavailable.
- Queue-processing failure.
- Worker execution failure.
- Duplicate queue delivery.
- Invalid MIME messages.
- Resend API unavailable.

Ensure failures are visible and recoverable.

---

# 17. Cost Strategy

The architecture is intended to operate at low cost for modest personal email traffic.

| Component | Initial strategy |
|---|---|
| Cloudflare Email Routing | Free inbound routing |
| Cloudflare Workers | Free or paid depending on workloads |
| Cloudflare Queues | Usage-based / applicable plan allowance |
| Cloudflare R2 | Storage and operation-based billing |
| Supabase | Start with an appropriate small project |
| Vercel | Start with an eligible plan |
| Resend | Free or paid depending on sending requirements |

Actual costs depend on usage and current provider limits.

The dominant long-term costs are likely to be:

1. Email and attachment storage.
2. Database capacity.
3. Background processing.
4. Outbound email volume.

The architecture avoids paying for an always-on VPS.

---

# 18. Major Technical Constraints

### 18.1 Inbound email size

Cloudflare Email Routing has a maximum incoming message size.

The application must respect this restriction and display appropriate expectations to users.

### 18.2 No native IMAP

The application initially provides webmail only.

Users cannot automatically connect standard IMAP clients.

This can be addressed later by adding an IMAP-compatible gateway.

### 18.3 Outgoing provider policies

Resend's policies, sending restrictions, and domain limits must be confirmed for ordinary mailbox correspondence.

The provider abstraction will allow switching services if necessary.

### 18.4 Spam protection

Cloudflare handles SMTP reception, but the application still needs policies for unwanted and malicious mail.

Advanced spam scoring and malware scanning can be introduced incrementally.

### 18.5 Vendor dependencies

This architecture depends on several managed providers.

Its modular design reduces lock-in by separating the database, object storage, email transport, and application interface.

### 18.6 Mailbox availability

The system's ability to receive mail depends on Cloudflare.

Reading and sending mail additionally depend on the availability of the relevant application and storage providers.

The platform must make operational failures visible.

---

# 19. Final Architecture Decisions

| Decision | Selection |
|---|---|
| Hosting model | Fully serverless |
| Incoming SMTP | Cloudflare Email Routing |
| Email ingestion | Cloudflare Worker |
| Async processing | Cloudflare Queues |
| Raw message storage | Cloudflare R2 |
| Attachment storage | Cloudflare R2 |
| Structured database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Realtime updates | Supabase Realtime |
| Application framework | Next.js |
| Frontend hosting | Vercel |
| Outgoing delivery | Resend |
| Database ORM | Prisma |
| Multi-domain support | Yes |
| Shared mailboxes | Yes |
| Email aliases | Yes |
| Unified inbox | Yes |
| Dedicated VPS | No |
| Traditional SMTP server | No |
| Traditional IMAP server | No |

---

# 20. Definition of Done

The MVP is considered complete when:

1. A user can sign in to the webmail application.
2. A custom domain can be configured.
3. A mailbox can be created.
4. Emails sent to that mailbox are received through Cloudflare.
5. Incoming messages are durably stored and processed.
6. Messages appear correctly in the inbox.
7. Attachments can be viewed or downloaded.
8. The user can compose and send emails through Resend.
9. Replies retain correct sender identities and conversation relationships.
10. Sent messages are retained in the application.
11. Multiple addresses and domains can be managed through one account.
12. Failed ingestion and processing jobs are recoverable.
13. Other users cannot access mailboxes without authorization.
14. No dedicated server is required.

**End goal:** A private, extensible, serverless email hosting platform that consolidates all owned custom-domain email addresses into a single application.


## A few important implementation notes

I've deliberately chosen **Cloudflare R2 rather than Supabase Storage for raw emails**.

This isn't because Supabase Storage wouldn't work. It's because Cloudflare Workers can write directly into R2 through native bindings, which avoids introducing an external HTTP dependency into the initial receipt path. R2 also accepts readable streams, making it suitable for storing raw email content. [Cloudflare Docs](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/?utm_source=chatgpt.com)

Cloudflare Queues then handles processing without a server. Queue consumers run as Workers, automatically process pending messages, and support retries and dead-letter queues. [Cloudflare Docs](https://developers.cloudflare.com/queues/reference/how-queues-works/?utm_source=chatgpt.com)

Two current platform constraints are worth highlighting:

- **Cloudflare Email Routing limits incoming messages to 25 MiB.** [Cloudflare Docs](https://0285ca83.previews.developers.cloudflare.com/email-service/platform/limits/?utm_source=chatgpt.com)
- **Cloudflare Queues limits individual queue messages to 128 KB.** That's why our queue contains an R2 object reference rather than the email itself. [Cloudflare Docs](https://developers.cloudflare.com/queues/platform/limits/?utm_source=chatgpt.com)

There is also one operational detail I'd enforce from day one: a successful R2 write must be recoverable even if the subsequent queue publication fails.

### My suggested implementation order

I'd actually build the core system in three milestones rather than attempting all six phases at once.

**Milestone 1 — Working email receiver:** Cloudflare Email Routing → Worker → R2 → Queue → Supabase. We can test everything using one domain and one mailbox, even before building the UI.

**Milestone 2 — Functional webmail:** Next.js on Vercel, Supabase Auth, inbox, message viewer, composer, and Resend integration.

**Milestone 3 — Multi-domain platform:** Domain management, aliases, shared mailboxes, unified inbox, search, and production hardening.

That gives us a working email system early, while keeping the more complicated management features separate.

**One final consideration:** Because this application will hold potentially important personal and business correspondence, I would prioritize data durability, mailbox access controls, and backup/restore functionality over visual polish. Those are the areas where a custom email system needs to be especially dependable.