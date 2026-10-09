# Mymail - Serverless Multi-Domain Email Hosting Platform

A private, modern, serverless email hosting platform and webmail client built with **Next.js**, **Cloudflare Workers**, **Cloudinary**, **Supabase PostgreSQL**, and **Resend (BYOK)**.

The UI is built with a simple, high-contrast **teal and white** design system.

---

## 🏗 Architecture Overview

```
                   CUSTOM DOMAINS (*@yourdomain.com)
                                 │
                                 ▼
                     CLOUDFLARE EMAIL ROUTING
                                 │
                                 ▼
                         CLOUDFLARE WORKER
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
            CLOUDINARY                       SUPABASE
        Raw MIME (.eml)                     PostgreSQL
        Attachments                    Metadata & Threads
                 │                               │
                 └───────────────┬───────────────┘
                                 ▼
                            NEXT.JS APP
                              (VERCEL)
                                 │
                                 ▼
                            WEBMAIL UI
                      (Simple Teal & White)
                                 │
                                 ▼
                     USER'S RESEND KEY (BYOK)
                                 │
                                 ▼
                             RECIPIENT
```

### Key Highlights
* **No Traditional Servers**: No Postfix, Dovecot, IMAP, or persistent VPS required.
* **Inbound Durability**: Cloudflare Email Routing passes incoming message streams directly to the Worker. The Worker uploads the raw `.eml` directly to **Cloudinary** before parsing.
* **Scheduled Cron Recovery**: A Cloudflare Cron Trigger runs every 15 minutes (`*/15 * * * *`) to automatically discover and reprocess any incomplete or failed messages from Cloudinary.
* **Bring Your Own Key (BYOK) for Resend**: Store multiple Resend sending keys per user/domain, encrypted at rest with **AES-256-GCM**.
* **Optimized Database Queries**: Composite indexes on `mailbox_messages` (`[mailbox_id, folder, is_deleted, is_archived, created_at(desc)]`), normalized threads, and fast pagination.
* **Email Sanitization**: Incoming HTML is sanitized using safe tag whitelisting, with automatic remote image blocking to protect user privacy against tracking pixels.

---

## 🚀 Quick Setup Instructions

When you return to test the platform, follow these simple steps:

### 1. Configure Environment Variables
Copy `.env.example` to `.env` in the root (and in `apps/web/.env.local`):

```bash
cp .env.example .env
cp .env.example apps/web/.env.local
```

Fill in the required values:
* **DATABASE_URL & DIRECT_URL**: From your Supabase project (Project Settings → Database).
* **NEXT_PUBLIC_SUPABASE_URL & ANON_KEY**: From Supabase (Project Settings → API).
* **SUPABASE_SERVICE_ROLE_KEY**: Service role key for backend and Cloudflare Worker.
* **CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET**: From your Cloudinary Dashboard.
* **APP_ENCRYPTION_SECRET**: Any 32+ character string (e.g. `openssl rand -base64 32`).
* **RESEND_API_KEY**: (Optional) global default key if not using BYOK in the UI.

### 2. Push Database Schema & Seed Demo Data
Push the Prisma schema to your Supabase PostgreSQL database:

```bash
npm run db:push
```

Optionally seed initial demo data:

```bash
npm run db:seed
```

### 3. Run Webmail Locally
Start the Next.js web application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

You can also click **"Enter Demo Mode"** on the login page to immediately test the webmail interface, composer, and settings!

---

## 🛠 Cloudflare Worker Deployment

To deploy the inbound email receiver Worker to Cloudflare:

1. In `workers/mail`:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
2. Set your Cloudflare Worker secrets:
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put CLOUDINARY_CLOUD_NAME
   npx wrangler secret put CLOUDINARY_API_KEY
   npx wrangler secret put CLOUDINARY_API_SECRET
   ```
3. Deploy the worker:
   ```bash
   npm run worker:deploy
   ```
4. In the Cloudflare Dashboard for your domain:
   * Go to **Email Routing** → **Routing Rules**.
   * Add a catch-all rule: `*@yourdomain.com` → **Send to Worker** → Select `mymail-worker`.

---

## 📁 Repository Structure

```
Mymail/
├── apps/
│   └── web/                     # Next.js 14 Webmail application (Teal & White)
│       ├── src/app/             # App Router pages and API routes
│       │   ├── api/emails/      # Messages listing, send, actions, attachments
│       │   ├── api/providers/   # BYOK Resend management & encryption
│       │   ├── api/domains/     # Domain and DNS management
│       │   └── api/mailboxes/   # Mailbox and alias creation
│       └── src/components/      # Sidebar, MessageList, MessageDetail, Composer, Settings
├── workers/
│   └── mail/                    # Cloudflare Worker for Inbound Email & Cron Recovery
│       └── src/
│           ├── index.ts         # email, scheduled, and HTTP fetch handlers
│           ├── ingestion.ts     # Stream receiver, Cloudinary raw upload, postal-mime
│           ├── cloudinary.ts    # Cloudinary raw storage client & signature generator
│           ├── recovery.ts      # Scheduled 15-minute cron recovery handler
│           └── supabase.ts      # Edge database queries & thread resolver
└── packages/
    ├── database/                # Prisma schema with optimized PostgreSQL indexes
    ├── mail-core/               # AES-256-GCM encryption, HTML sanitizer, types
    └── shared/                  # Common constants
```

---

## 🔒 Security Best Practices
* **Zero Plaintext Secrets**: User-provided Resend API keys are encrypted with AES-256-GCM using `APP_ENCRYPTION_SECRET` before being written to PostgreSQL.
* **XSS Sanitization**: HTML email bodies are sanitized with a strict whitelist (`sanitize-html`), disabling `script`, `iframe`, and unsafe event handlers.
* **Tracking Pixel Protection**: External remote images are hidden by default with a user-controlled "Load Images" button.
* **Idempotent Ingestion**: Raw emails are assigned unique UUIDs and saved to Cloudinary first; duplicate deliveries will not corrupt existing threads.

# cupidMail
