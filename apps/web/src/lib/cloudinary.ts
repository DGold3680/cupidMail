import fs from "node:fs";
import path from "node:path";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey?: string;
  apiSecret?: string;
  isCustom: boolean;
}

/**
 * Returns active Cloudinary configuration:
 * Prioritizes custom BYOK configuration if saved by user,
 * otherwise falls back to environment defaults.
 */
export function getActiveCloudinaryConfig(): CloudinaryConfig {
  try {
    const configPath = path.resolve(process.cwd(), ".cloudinary-byok.json");
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (data.cloudName && data.cloudName.trim()) {
        return {
          cloudName: data.cloudName.trim(),
          apiKey: data.apiKey?.trim() || "",
          apiSecret: data.apiSecret?.trim() || "",
          isCustom: true,
        };
      }
    }
  } catch (err) {
    // fallback to env defaults
  }

  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    isCustom: false,
  };
}

/**
 * Returns a direct or attachment-forced download URL for an attachment in Cloudinary
 */
export function getAttachmentDownloadUrl(storageKey: string, filename: string): string {
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    if (storageKey.includes("/raw/upload/")) {
      return storageKey.replace(
        "/raw/upload/",
        `/raw/upload/fl_attachment:${encodeURIComponent(filename)}/`
      );
    }
    return storageKey;
  }

  const { cloudName } = getActiveCloudinaryConfig();
  if (!cloudName) {
    throw new Error("Cloudinary cloud name is not configured.");
  }

  return `https://res.cloudinary.com/${cloudName}/raw/upload/fl_attachment:${encodeURIComponent(filename)}/${storageKey}`;
}

/**
 * Fetches raw email content from Cloudinary
 */
export async function getRawEmailContent(storageKey: string): Promise<string> {
  let url = storageKey;

  if (!url.startsWith("http")) {
    const { cloudName } = getActiveCloudinaryConfig();
    if (!cloudName) {
      throw new Error("Cloudinary cloud name is not configured.");
    }
    url = `https://res.cloudinary.com/${cloudName}/raw/upload/${storageKey}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch raw email from Cloudinary: ${response.status}`);
  }

  return await response.text();
}
