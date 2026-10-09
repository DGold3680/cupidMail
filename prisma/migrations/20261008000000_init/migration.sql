-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "RecipientType" AS ENUM ('TO', 'CC', 'BCC');

-- CreateEnum
CREATE TYPE "MailFolder" AS ENUM ('INBOX', 'SENT', 'DRAFTS', 'TRASH', 'ARCHIVE', 'SPAM');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('RESEND', 'SES', 'SMTP');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'INVALID', 'DISABLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "inbound_status" "ServiceStatus" NOT NULL DEFAULT 'INACTIVE',
    "outbound_status" "ServiceStatus" NOT NULL DEFAULT 'INACTIVE',
    "dns_records" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailboxes" (
    "id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "local_part" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "display_name" TEXT,
    "status" "MailboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "quota_bytes" BIGINT NOT NULL DEFAULT 10737418240,
    "used_bytes" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mailboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_members" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aliases" (
    "id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "target_mailbox_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threads" (
    "id" TEXT NOT NULL,
    "subject_normalized" TEXT NOT NULL,
    "snippet" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "ingestion_id" TEXT,
    "internet_message_id" TEXT,
    "thread_id" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "from_name" TEXT,
    "reply_to" TEXT,
    "subject" TEXT NOT NULL,
    "text_body" TEXT,
    "html_body" TEXT,
    "raw_storage_key" TEXT,
    "direction" "MessageDirection" NOT NULL DEFAULT 'INBOUND',
    "sent_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "in_reply_to" TEXT,
    "references" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_recipients" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT,
    "recipient_type" "RecipientType" NOT NULL DEFAULT 'TO',

    CONSTRAINT "message_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mailbox_messages" (
    "id" TEXT NOT NULL,
    "mailbox_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "folder" "MailFolder" NOT NULL DEFAULT 'INBOX',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_id" TEXT,
    "is_inline" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_jobs" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sender" TEXT,
    "status" "IngestionStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "last_error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "ingestion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_provider_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Resend Provider',
    "provider" "ProviderType" NOT NULL DEFAULT 'RESEND',
    "encrypted_credentials" TEXT NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domain_sending_config" (
    "id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "provider_connection_id" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_from_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_sending_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outgoing_deliveries" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RESEND',
    "provider_message_id" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outgoing_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "domains_name_key" ON "domains"("name");

-- CreateIndex
CREATE INDEX "domains_owner_id_idx" ON "domains"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "mailboxes_address_key" ON "mailboxes"("address");

-- CreateIndex
CREATE INDEX "mailboxes_domain_id_idx" ON "mailboxes"("domain_id");

-- CreateIndex
CREATE INDEX "mailboxes_address_idx" ON "mailboxes"("address");

-- CreateIndex
CREATE INDEX "mailbox_members_user_id_idx" ON "mailbox_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_members_mailbox_id_user_id_key" ON "mailbox_members"("mailbox_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "aliases_address_key" ON "aliases"("address");

-- CreateIndex
CREATE INDEX "aliases_domain_id_idx" ON "aliases"("domain_id");

-- CreateIndex
CREATE INDEX "aliases_target_mailbox_id_idx" ON "aliases"("target_mailbox_id");

-- CreateIndex
CREATE INDEX "threads_last_message_at_idx" ON "threads"("last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "messages_ingestion_id_key" ON "messages"("ingestion_id");

-- CreateIndex
CREATE INDEX "messages_thread_id_created_at_idx" ON "messages"("thread_id", "created_at" ASC);

-- CreateIndex
CREATE INDEX "messages_internet_message_id_idx" ON "messages"("internet_message_id");

-- CreateIndex
CREATE INDEX "messages_from_address_idx" ON "messages"("from_address");

-- CreateIndex
CREATE INDEX "messages_received_at_idx" ON "messages"("received_at" DESC);

-- CreateIndex
CREATE INDEX "message_recipients_message_id_recipient_type_idx" ON "message_recipients"("message_id", "recipient_type");

-- CreateIndex
CREATE INDEX "message_recipients_address_idx" ON "message_recipients"("address");

-- CreateIndex
CREATE INDEX "mailbox_messages_mailbox_id_folder_is_deleted_is_archived_c_idx" ON "mailbox_messages"("mailbox_id", "folder", "is_deleted", "is_archived", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mailbox_messages_mailbox_id_is_starred_is_deleted_created_a_idx" ON "mailbox_messages"("mailbox_id", "is_starred", "is_deleted", "created_at" DESC);

-- CreateIndex
CREATE INDEX "mailbox_messages_mailbox_id_is_read_idx" ON "mailbox_messages"("mailbox_id", "is_read");

-- CreateIndex
CREATE INDEX "mailbox_messages_message_id_idx" ON "mailbox_messages"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_messages_mailbox_id_message_id_key" ON "mailbox_messages"("mailbox_id", "message_id");

-- CreateIndex
CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");

-- CreateIndex
CREATE INDEX "ingestion_jobs_status_received_at_idx" ON "ingestion_jobs"("status", "received_at" DESC);

-- CreateIndex
CREATE INDEX "ingestion_jobs_recipient_idx" ON "ingestion_jobs"("recipient");

-- CreateIndex
CREATE INDEX "email_provider_connections_user_id_idx" ON "email_provider_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "domain_sending_config_domain_id_key" ON "domain_sending_config"("domain_id");

-- CreateIndex
CREATE INDEX "domain_sending_config_provider_connection_id_idx" ON "domain_sending_config"("provider_connection_id");

-- CreateIndex
CREATE INDEX "outgoing_deliveries_message_id_idx" ON "outgoing_deliveries"("message_id");

-- CreateIndex
CREATE INDEX "outgoing_deliveries_provider_message_id_idx" ON "outgoing_deliveries"("provider_message_id");

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_members" ADD CONSTRAINT "mailbox_members_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_members" ADD CONSTRAINT "mailbox_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aliases" ADD CONSTRAINT "aliases_target_mailbox_id_fkey" FOREIGN KEY ("target_mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_messages" ADD CONSTRAINT "mailbox_messages_mailbox_id_fkey" FOREIGN KEY ("mailbox_id") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mailbox_messages" ADD CONSTRAINT "mailbox_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_provider_connections" ADD CONSTRAINT "email_provider_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_sending_config" ADD CONSTRAINT "domain_sending_config_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_sending_config" ADD CONSTRAINT "domain_sending_config_provider_connection_id_fkey" FOREIGN KEY ("provider_connection_id") REFERENCES "email_provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outgoing_deliveries" ADD CONSTRAINT "outgoing_deliveries_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

