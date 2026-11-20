import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(srcDir, "../../../..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config();

function read(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function optional(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

const nodeEnv = process.env.NODE_ENV ?? "development";

export const env = {
  NODE_ENV: nodeEnv,
  isTest: nodeEnv === "test",
  isProduction: nodeEnv === "production",
  API_PORT: Number(process.env.API_PORT ?? 4000),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  APP_URL: process.env.APP_URL ?? "http://localhost:5173",
  DATABASE_URL: read("DATABASE_URL", "postgresql://flowboard:flowboard@localhost:5432/flowboard"),
  JWT_ACCESS_SECRET: read("JWT_ACCESS_SECRET", "dev-only-access-secret-change-me-please-32b"),
  JWT_REFRESH_SECRET: read("JWT_REFRESH_SECRET", "dev-only-refresh-secret-change-me-please-32"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 14),
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS ?? (nodeEnv === "test" ? 4 : 12)),
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR ?? path.join(repoRoot, "apps/api/uploads")),
  STORAGE_DRIVER: (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3",
  MAX_UPLOAD_BYTES: Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024),
  S3_ENDPOINT: optional("S3_ENDPOINT"),
  S3_REGION: process.env.S3_REGION ?? "us-east-1",
  S3_BUCKET: optional("S3_BUCKET"),
  S3_ACCESS_KEY: optional("S3_ACCESS_KEY"),
  S3_SECRET_KEY: optional("S3_SECRET_KEY"),
  SMTP_HOST: optional("SMTP_HOST"),
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 1025),
  SMTP_FROM: process.env.SMTP_FROM ?? "Flowboard <noreply@flowboard.local>",
  JOBS_DRIVER: (process.env.JOBS_DRIVER ?? "inprocess") as "inprocess" | "bullmq",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  JOB_INTERVAL_MS: Number(process.env.JOB_INTERVAL_MS ?? 60_000),
  STRIPE_SECRET_KEY: optional("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET"),
  STRIPE_PRICE_PRO: optional("STRIPE_PRICE_PRO"),
  STRIPE_PRICE_BUSINESS: optional("STRIPE_PRICE_BUSINESS"),
};

export const billingMode = env.STRIPE_SECRET_KEY ? "stripe" : "mock";
