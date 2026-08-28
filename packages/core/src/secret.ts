import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_ENV = "ENCRYPTION_KEY";

function key() {
  const raw = process.env[KEY_ENV];
  if (!raw || raw.length < 32) {
    throw new Error(`${KEY_ENV} muss mindestens 32 Zeichen haben.`);
  }
  return Buffer.from(raw.slice(0, 32), "utf8");
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${payload.toString("base64")}`;
}

export function decryptJson<T>(blob: string): T {
  const [ivB64, tagB64, dataB64] = blob.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Ungültiges Secret-Format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const json = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(json) as T;
}
