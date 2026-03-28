import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "./logger";

// ─── S3 Configuration ──────────────────────────────────────────────

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_REGION = process.env.S3_REGION || "auto";

let s3Client: S3Client | null = null;

export function isS3Configured(): boolean {
  return !!(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);
}

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID!,
        secretAccessKey: S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
  }
  return s3Client;
}

// ─── Local File Storage Fallback ───────────────────────────────────

const VAULT_UPLOADS_DIR = path.join(process.cwd(), "vault-uploads");

function ensureLocalDir(familyId: number): string {
  const dir = path.join(VAULT_UPLOADS_DIR, String(familyId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ─── Retry helper for S3 operations ────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  retries = 2,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < retries) {
        const delay = (attempt + 1) * 1000;
        logger.warn({ err, attempt: attempt + 1, label }, `S3 ${label} failed, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        logger.error({ err, label }, `S3 ${label} failed after ${retries + 1} attempts`);
        throw err;
      }
    }
  }
  throw new Error("unreachable");
}

// ─── Upload File ───────────────────────────────────────────────────

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if (isS3Configured()) {
    const client = getS3Client();
    await withRetry(
      () =>
        client.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
          }),
        ),
      "upload",
    );
    return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  }

  // Local fallback
  const parts = key.split("/");
  const familyId = Number(parts[0]);
  const filename = parts.slice(1).join("/");
  const dir = ensureLocalDir(familyId);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, body);
  return `/api/vault-files/${key}`;
}

// ─── Delete File ───────────────────────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
  if (isS3Configured()) {
    const client = getS3Client();
    await withRetry(
      () =>
        client.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
          }),
        ),
      "delete",
    );
    return;
  }

  // Local fallback
  const filePath = path.join(VAULT_UPLOADS_DIR, key);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ─── Get Signed Download URL ───────────────────────────────────────

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 900,
): Promise<string> {
  if (isS3Configured()) {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn });
  }

  // Local fallback — return the authenticated local route with a simple token
  const token = crypto.randomBytes(16).toString("hex");
  return `/api/vault-files/${key}?token=${token}`;
}

// ─── Build a storage key ───────────────────────────────────────────

export function buildFileKey(familyId: number, originalFilename: string): string {
  const timestamp = Date.now();
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${familyId}/${timestamp}-${safeName}`;
}
