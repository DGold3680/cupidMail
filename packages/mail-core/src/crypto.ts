import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const TAG_LENGTH = 16; // Standard 128-bit authentication tag

/**
 * Derives a consistent 32-byte key from the environment secret using SHA-256.
 */
function getDerivedKey(secret?: string): Buffer {
  const secretKey = secret || process.env.APP_ENCRYPTION_SECRET;
  if (!secretKey) {
    throw new Error(
      "APP_ENCRYPTION_SECRET environment variable is missing. It is required for securely encrypting provider keys."
    );
  }
  return crypto.createHash("sha256").update(secretKey).digest();
}

/**
 * Encrypts sensitive credentials (like Resend API keys) using AES-256-GCM.
 * Output format: base64(iv + tag + ciphertext)
 */
export function encryptCredentials(plaintext: string, secret?: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty credentials string");
  }

  const key = getDerivedKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Combine IV + TAG + CIPHERTEXT into a single buffer
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypts sensitive credentials with authentication verification.
 */
export function decryptCredentials(encryptedBase64: string, secret?: string): string {
  if (!encryptedBase64) {
    throw new Error("Cannot decrypt empty encrypted credentials string");
  }

  const key = getDerivedKey(secret);
  const combined = Buffer.from(encryptedBase64, "base64");

  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Invalid encrypted payload length");
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
