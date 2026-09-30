const PUBLIC_LEAK = [
  "NEXT_PUBLIC_DATABASE_URL",
  "NEXT_PUBLIC_DIRECT_DATABASE_URL",
  "NEXT_PUBLIC_ACCELERATE_URL",
  "NEXT_PUBLIC_ENCRYPTION_KEY",
];

export function assertServerDatabaseEnv() {
  if (typeof window !== "undefined") {
    throw new Error("Prisma-Client darf nicht im Browser laufen.");
  }
  for (const key of PUBLIC_LEAK) {
    if (process.env[key]) {
      throw new Error(`${key} ist gesetzt — DB-Secrets gehören nicht in NEXT_PUBLIC_*.`);
    }
  }
  const direct = process.env.DIRECT_DATABASE_URL || "";
  if (direct.startsWith("prisma://") || direct.startsWith("prisma+postgres://")) {
    throw new Error("DIRECT_DATABASE_URL muss postgresql:// sein (Migrationen), nicht Accelerate.");
  }
  const key = process.env.ENCRYPTION_KEY || "";
  if (key && /change-me/i.test(key)) {
    console.warn("ENCRYPTION_KEY ist noch der Beispielwert.");
  }
}
