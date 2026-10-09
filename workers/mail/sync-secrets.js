import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, "../../.env");

if (!fs.existsSync(rootEnvPath)) {
  console.error("Root .env file not found at:", rootEnvPath);
  process.exit(1);
}

// Parse root .env
const envContent = fs.readFileSync(rootEnvPath, "utf8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const match = trimmed.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    envVars[key] = val;
  }
}

// Build secrets payload for Cloudflare Worker
const secrets = {
  SUPABASE_URL: envVars.NEXT_PUBLIC_SUPABASE_URL || envVars.SUPABASE_URL || "",
  SUPABASE_SECRET_KEY: envVars.SUPABASE_SECRET_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY || "",
  CLOUDINARY_CLOUD_NAME: envVars.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: envVars.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: envVars.CLOUDINARY_API_SECRET || "",
  ADMIN_API_SECRET: envVars.ADMIN_API_SECRET || "admin-secret",
};

// Also write .dev.vars for local wrangler dev
const devVarsContent = Object.entries(secrets)
  .map(([k, v]) => `${k}="${v}"`)
  .join("\n");
fs.writeFileSync(path.resolve(__dirname, ".dev.vars"), devVarsContent, "utf8");
console.log("Updated workers/mail/.dev.vars for local testing.");

// Also upload to Cloudflare via wrangler secret bulk
const tempJsonPath = path.resolve(__dirname, ".temp-secrets.json");
fs.writeFileSync(tempJsonPath, JSON.stringify(secrets), "utf8");

try {
  console.log("Uploading secrets to Cloudflare Worker...");
  execSync(`npx wrangler secret bulk "${tempJsonPath}"`, {
    cwd: __dirname,
    stdio: "inherit",
  });
  console.log("Successfully uploaded all secrets to Cloudflare!");
} catch (err) {
  console.log("Note: To upload secrets to Cloudflare production, run 'npx wrangler login' first.");
} finally {
  if (fs.existsSync(tempJsonPath)) {
    fs.unlinkSync(tempJsonPath);
  }
}

