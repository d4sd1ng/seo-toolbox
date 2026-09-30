import { PrismaClient } from "@prisma/client";

const SLOW_MS = Number(process.env.PRISMA_SLOW_MS ?? 200);
const ALL = process.env.PRISMA_LOG_QUERIES === "1";

type SlowRow = { model: string; operation: string; ms: number };

function emit(row: SlowRow & { error?: string }) {
  const payload = { prisma: true, ...row };
  if (row.error) console.error(payload);
  else console.info(payload);
}

/**
 * Prisma 6: Query-Logging über Client Extension (nicht $use — deprecated).
 * Args werden nicht geloggt (Passwörter, Session-Hashes).
 */
export function withQueryLogging(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = Date.now();
          try {
            const result = await query(args);
            const ms = Date.now() - start;
            if (ALL || ms >= SLOW_MS) emit({ model, operation, ms });
            return result;
          } catch (error) {
            emit({
              model,
              operation,
              ms: Date.now() - start,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        },
      },
    },
  });
}
