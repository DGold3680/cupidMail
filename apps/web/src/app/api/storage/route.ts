import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getActiveCloudinaryConfig } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

const CONFIG_FILE = path.resolve(process.cwd(), ".cloudinary-byok.json");

/**
 * GET /api/storage
 * Returns the current Cloudinary storage configuration status.
 * Shows whether custom BYOK credentials are in use or environment defaults.
 */
export async function GET() {
  try {
    const config = getActiveCloudinaryConfig();
    const envCloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
    const hasEnvDefaults = Boolean(envCloudName && process.env.CLOUDINARY_API_KEY);

    return NextResponse.json({
      isCustom: config.isCustom,
      cloudName: config.cloudName || "",
      hasApiKey: Boolean(config.apiKey),
      hasApiSecret: Boolean(config.apiSecret),
      hasEnvDefaults,
      envCloudName,
    });
  } catch (error: any) {
    console.error("Failed to get storage config:", error);
    return NextResponse.json(
      { error: "Failed to read storage settings", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/storage
 * Save custom BYOK Cloudinary credentials or reset to environment defaults.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, cloudName, apiKey, apiSecret } = body;

    // Reset to environment defaults
    if (action === "reset" || (!cloudName && !apiKey && !apiSecret)) {
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
      }
      const envConfig = getActiveCloudinaryConfig();
      return NextResponse.json({
        success: true,
        message: "Reset to environment defaults.",
        isCustom: false,
        cloudName: envConfig.cloudName,
      });
    }

    if (!cloudName || typeof cloudName !== "string" || !cloudName.trim()) {
      return NextResponse.json(
        { error: "Please enter a valid Cloudinary Cloud Name." },
        { status: 400 }
      );
    }

    const newConfig = {
      cloudName: cloudName.trim(),
      apiKey: apiKey?.trim() || "",
      apiSecret: apiSecret?.trim() || "",
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: "Custom Cloudinary storage connected successfully.",
      isCustom: true,
      cloudName: newConfig.cloudName,
    });
  } catch (error: any) {
    console.error("Failed to update storage config:", error);
    return NextResponse.json(
      { error: "Failed to update storage settings", details: error?.message },
      { status: 500 }
    );
  }
}
