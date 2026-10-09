import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma, User, Role } from "@/lib/db";

export const SESSION_COOKIE_NAME = "cupid_token";
const SESSION_EXPIRY_DAYS = 7;

function getSecretKey(): string {
  return (
    process.env.APP_ENCRYPTION_SECRET ||
    "cupid-mail-default-secret-salt-881337-FAF7F2"
  );
}

/**
 * Hash a plain text password with a secure salt using scrypt (RFC 7914).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verify a plain text password against a stored salt:hash string.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(":")) return false;
  try {
    const [salt, key] = storedHash.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (e) {
    return false;
  }
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
  exp: number;
}

/**
 * Creates an HMAC-SHA256 signed session token.
 */
export function createSessionToken(user: { id: string; email: string; role?: Role }): string {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role || Role.MEMBER,
    exp: Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecretKey())
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed session token.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  try {
    const [payloadB64, signature] = token.split(".");
    const expectedSignature = crypto
      .createHmac("sha256", getSecretKey())
      .update(payloadB64)
      .digest("base64url");

    if (signature !== expectedSignature) {
      return null;
    }

    const json = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload: SessionPayload = JSON.parse(json);

    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Retrieves the currently authenticated user from cookies or Authorization header.
 */
export async function getSessionUser(req?: Request): Promise<User | null> {
  let token: string | undefined;

  // 1. Try Request headers first if provided
  if (req) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }
  }

  // 2. Fall back to next/headers cookies()
  if (!token) {
    try {
      const cookieStore = cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // cookies() might fail in some contexts outside Next.js request life cycle
    }
  }

  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    return user;
  } catch (e) {
    console.error("Failed to fetch session user:", e);
    return null;
  }
}
