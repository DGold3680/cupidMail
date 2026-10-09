export interface EmailAddress {
  address: string;
  name?: string;
}

export interface AttachmentData {
  filename: string;
  contentType: string;
  sizeBytes: number;
  content: Uint8Array | Buffer | string; // Base64 or bytes
  contentId?: string;
  isInline?: boolean;
}

export interface SendEmailPayload {
  mailboxId: string;
  fromAddress: string;
  fromName?: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  attachments?: {
    filename: string;
    content: string; // base64
    contentType: string;
  }[];
}

export interface SendResult {
  success: boolean;
  messageId: string;
  providerMessageId?: string;
  error?: string;
}

export interface IngestionMetadata {
  ingestionId: string;
  recipient: string;
  sender: string;
  rawStorageKey: string;
  subject: string;
  timestamp: string;
}

export interface ProviderCredentials {
  apiKey: string;
  provider: "RESEND" | "SES" | "SMTP";
}

export interface DnsCheckRecord {
  type: "MX" | "TXT" | "CNAME";
  name: string;
  value: string;
  priority?: number;
  purpose: "Inbound Routing" | "SPF" | "DKIM" | "DMARC";
  status: "verified" | "pending" | "missing";
}
