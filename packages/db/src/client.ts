import { PrismaClient } from "@prisma/client";
import { accelerateUrl, usesAccelerate } from "./accelerate";
import { assertServerDatabaseEnv } from "./assert-server-env";
import { withQueryLogging } from "./with-logging";

function pooledUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", process.env.PRISMA_CONNECTION_LIMIT ?? "10");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", process.env.PRISMA_POOL_TIMEOUT ?? "10");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function withAccelerateOptional(client: ReturnType<typeof withQueryLogging>) {
  if (!usesAccelerate()) return client;
  try {
    // Optional: lokal ohne das Paket bleibt Postgres.
    const { withAccelerate } = require("@prisma/extension-accelerate") as {
      withAccelerate: () => Parameters<typeof client.$extends>[0];
    };
    return client.$extends(withAccelerate());
  } catch {
    console.warn("ACCELERATE_URL gesetzt, aber @prisma/extension-accelerate ist nicht installiert.");
    return client;
  }
}

export function createPrismaClient() {
  assertServerDatabaseEnv();
  const accelerate = accelerateUrl();
  const direct = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  const url = usesAccelerate() ? accelerate : direct ? pooledUrl(direct) : undefined;
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: url ? { db: { url } } : undefined,
  });
  return withAccelerateOptional(withQueryLogging(base));
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
