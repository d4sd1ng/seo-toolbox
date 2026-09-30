export function accelerateUrl() {
  return (process.env.ACCELERATE_URL || process.env.DATABASE_URL || "").trim();
}

export function usesAccelerate() {
  const url = accelerateUrl();
  return url.startsWith("prisma://") || url.startsWith("prisma+postgres://");
}

/** Nur gesetzt, wenn Accelerate aktiv ist — sonst leeres Objekt (lokales Postgres). */
export function readCache(ttlSec: number, swrSec = Math.max(1, Math.floor(ttlSec / 2))) {
  if (!usesAccelerate()) return {};
  return { cacheStrategy: { ttl: ttlSec, swr: swrSec } };
}
