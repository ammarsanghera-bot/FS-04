import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });

export default async function globalSetup() {
  const testUrl = process.env.TEST_DATABASE_URL ?? "postgresql://flowboard:flowboard@localhost:5432/flowboard_test";
  if (!testUrl.includes("_test")) {
    throw new Error("TEST_DATABASE_URL must point at a database whose name ends with _test");
  }
  const url = new URL(testUrl);
  const database = url.pathname.replace(/^\//, "");
  const admin = new URL(testUrl);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${database}"`);
  }
  await client.end();
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
