import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  const hash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(key, "hex");
  return storedBuffer.length === hash.length && timingSafeEqual(hash, storedBuffer);
}