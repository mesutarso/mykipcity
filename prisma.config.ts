import "dotenv/config";
import { defineConfig, env } from "prisma/config";
import { resolve, dirname } from "node:path";
import { mkdirSync, openSync, closeSync } from "node:fs";
const input = env("DATABASE_URL");
if (!input.startsWith("file:")) throw new Error("SQLite locale requise");
const path = resolve(input.slice(5));
mkdirSync(dirname(path), { recursive: true });
closeSync(openSync(path, "a"));
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: `file:${path}` },
});
