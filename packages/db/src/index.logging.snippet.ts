// In packages/db/src/index.ts den Client so wrappen:

import { PrismaClient } from "@prisma/client";
import { withQueryLogging } from "./with-logging";

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof withQueryLogging> };

const base =
  globalForPrisma.prisma ??
  withQueryLogging(
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    }),
  );

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base;

export const prisma = base;
