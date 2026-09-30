#!/usr/bin/env node
/**
 * Ein Prozess für die lokale Entwicklung: Postgres/Redis (Compose) + Web + Worker.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function run(name, cmd, args, extra = {}) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    ...extra,
  });
  const tag = (buf, stream) => {
    for (const line of buf.toString().split("\n")) {
      if (line.trim()) stream.write(`[${name}] ${line}\n`);
    }
  };
  child.stdout.on("data", (d) => tag(d, process.stdout));
  child.stderr.on("data", (d) => tag(d, process.stderr));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited ${code}`);
    }
  });
  return child;
}

if (existsSync(`${root}/docker-compose.yml`)) {
  run("infra", "docker", ["compose", "up", "-d", "postgres", "redis"]);
}

const web = run("web", "pnpm", ["--filter", "web", "dev"]);
const worker = run("worker", "pnpm", ["--filter", "worker", "dev"]);

function shutdown() {
  web.kill("SIGTERM");
  worker.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
