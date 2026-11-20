import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://flowboard:flowboard@localhost:5432/flowboard_test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-change-me-please-32b";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-change-me-please-32";
process.env.BCRYPT_ROUNDS = "4";
process.env.JOBS_DRIVER = "inprocess";
