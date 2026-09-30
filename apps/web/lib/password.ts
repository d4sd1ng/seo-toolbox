import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(plain: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    const next = scryptSync(plain, salt, 32);
    const expected = Buffer.from(hash, "hex");
    if (expected.length !== next.length) return false;
    return timingSafeEqual(expected, next);
  } catch {
    return false;
  }
}
