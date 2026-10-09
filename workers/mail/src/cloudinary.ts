import { Env } from "./types";

/**
 * Generates SHA-1 signature required by Cloudinary Upload API
 */
async function generateCloudinarySignature(
  params: Record<string, string | number>,
  apiSecret: string
): Promise<string> {
  // Sort parameters alphabetically by key
  const sortedKeys = Object.keys(params).sort();
  const serialized = sortedKeys.map((key) => `${key}=${params[key]}`).join("&") + apiSecret;

  const msgUint8 = new TextEncoder().encode(serialized);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  bytes: number;
  resource_type: string;
}

/**
 * Uploads raw email (.eml) to Cloudinary raw storage
 */
export async function uploadRawEmailToCloudinary(
  env: Env,
  publicId: string,
  content: ArrayBuffer | Uint8Array
): Promise<CloudinaryUploadResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: publicId,
    timestamp,
  };

  const signature = await generateCloudinarySignature(paramsToSign, env.CLOUDINARY_API_SECRET);

  const formData = new FormData();
  formData.append("file", new Blob([content], { type: "message/rfc822" }), `${publicId}.eml`);
  formData.append("public_id", publicId);
  formData.append("timestamp", timestamp.toString());
  formData.append("api_key", env.CLOUDINARY_API_KEY);
  formData.append("signature", signature);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/raw/upload`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary raw email upload failed [${response.status}]: ${errorText}`);
  }

  return (await response.json()) as CloudinaryUploadResult;
}

/**
 * Uploads an attachment to Cloudinary raw storage
 */
export async function uploadAttachmentToCloudinary(
  env: Env,
  publicId: string,
  content: ArrayBuffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<CloudinaryUploadResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: publicId,
    timestamp,
  };

  const signature = await generateCloudinarySignature(paramsToSign, env.CLOUDINARY_API_SECRET);

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([content], { type: contentType || "application/octet-stream" }),
    filename
  );
  formData.append("public_id", publicId);
  formData.append("timestamp", timestamp.toString());
  formData.append("api_key", env.CLOUDINARY_API_KEY);
  formData.append("signature", signature);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/raw/upload`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary attachment upload failed [${response.status}]: ${errorText}`);
  }

  return (await response.json()) as CloudinaryUploadResult;
}

/**
 * Fetches raw email from Cloudinary (using secure URL or authenticated download)
 */
export async function fetchRawEmailFromCloudinary(
  env: Env,
  publicIdOrUrl: string
): Promise<ArrayBuffer> {
  let downloadUrl = publicIdOrUrl;

  if (!publicIdOrUrl.startsWith("http")) {
    downloadUrl = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicIdOrUrl}`;
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary fetch raw email failed [${response.status}]: ${errorText}`);
  }

  return await response.arrayBuffer();
}

