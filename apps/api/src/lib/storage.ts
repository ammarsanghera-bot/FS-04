import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { randomToken } from "./crypto.js";
import { Errors } from "./errors.js";

export interface StoredFile {
  storageKey: string;
  size: number;
}

export interface FileStorage {
  save(input: { folder: string; originalName: string; bytes: Buffer }): Promise<StoredFile>;
  open(storageKey: string): Promise<NodeJS.ReadableStream>;
  remove(storageKey: string): Promise<void>;
}

function safeKey(storageKey: string) {
  if (!storageKey || storageKey.includes("..") || path.isAbsolute(storageKey)) {
    throw Errors.badRequest("Invalid file reference");
  }
  const root = path.resolve(env.UPLOAD_DIR);
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw Errors.badRequest("Invalid file reference");
  }
  return full;
}

export class LocalFileStorage implements FileStorage {
  async save(input: { folder: string; originalName: string; bytes: Buffer }): Promise<StoredFile> {
    const extension = path.extname(input.originalName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
    const storageKey = path.posix.join(input.folder.replace(/\\/g, "/"), `${randomToken(16)}${extension}`);
    const full = safeKey(storageKey);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.bytes);
    return { storageKey, size: input.bytes.byteLength };
  }

  async open(storageKey: string) {
    return createReadStream(safeKey(storageKey));
  }

  async remove(storageKey: string) {
    await rm(safeKey(storageKey), { force: true });
  }
}

/**
 * S3-compatible adapter. The application selects it when STORAGE_DRIVER=s3
 * and the bucket credentials are present. The AWS SDK is intentionally not
 * bundled; wire `@aws-sdk/client-s3` here when object storage is provisioned.
 */
export class S3FileStorage implements FileStorage {
  async save(): Promise<StoredFile> {
    throw Errors.badRequest("S3 storage is selected but the object-storage client is not configured yet. Use STORAGE_DRIVER=local.");
  }

  async open(): Promise<NodeJS.ReadableStream> {
    throw Errors.badRequest("S3 storage is not configured");
  }

  async remove() {
    throw Errors.badRequest("S3 storage is not configured");
  }
}

export function createStorage(): FileStorage {
  if (env.STORAGE_DRIVER === "s3" && env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY) {
    return new S3FileStorage();
  }
  return new LocalFileStorage();
}

export const storage = createStorage();
