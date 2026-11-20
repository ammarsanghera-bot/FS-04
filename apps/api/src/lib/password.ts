import bcrypt from "bcrypt";
import { env } from "../config/env.js";

let dummyHash: string | null = null;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string | null) {
  if (!dummyHash) dummyHash = await bcrypt.hash("not-a-real-password", env.BCRYPT_ROUNDS);
  return bcrypt.compare(password, passwordHash ?? dummyHash);
}
