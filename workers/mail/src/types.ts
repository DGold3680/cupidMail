export interface Env {
  // Cloudflare Worker Environment Variables & Secrets
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY?: string; // New Supabase Secret Key format
  SUPABASE_SERVICE_ROLE_KEY?: string; // Legacy service role key
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  ADMIN_API_SECRET?: string;
}

export interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}
