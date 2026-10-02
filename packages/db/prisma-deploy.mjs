import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const cwd = fileURLToPath(new URL(".", import.meta.url));
function run(args) {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], { cwd, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Database migration command failed.");
}

try {
  const [state] = await prisma.$queryRaw`
    SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public') AS present
  `;
  await prisma.$disconnect();
  if (!state || typeof state.present !== "boolean") throw new Error("Cannot determine database state.");
  if (!state.present) {
    // Preserve deployed migration history while initializing tables before the older index migration.
    run(["db", "execute", "--file", "prisma/migrations/20260830120000_init/migration.sql", "--schema", "prisma/schema.prisma"]);
    run(["migrate", "resolve", "--applied", "20260830120000_init"]);
  }
  run(["migrate", "deploy"]);
} finally {
  await prisma.$disconnect();
}
