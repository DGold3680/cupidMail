import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load root .env file across all workspaces
loadEnvConfig(path.resolve(__dirname, "../.."));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@mymail/database", "@mymail/mail-core"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "sanitize-html"],
  },
};

export default nextConfig;
