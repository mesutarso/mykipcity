import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

if (process.env.DEMO_MODE !== "true") {
  throw new Error("Cette tranche est réservée à la démonstration. DEMO_MODE=true est requis ; ouverture réelle non autorisée.");
}
const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:")) throw new Error("Une base SQLite locale est requise.");
export const databasePath = resolve(url.slice(5));
mkdirSync(dirname(databasePath), { recursive: true });
const globalDb = globalThis as unknown as { kipDb?: PrismaClient };
class ConfiguredAdapter extends PrismaBetterSqlite3 {
  async connect() {
    const connection = await super.connect();
    for (const sql of ["PRAGMA foreign_keys = ON", "PRAGMA synchronous = FULL", "PRAGMA busy_timeout = 5000"]) {
      await connection.queryRaw({ sql, args: [], argTypes: [] });
    }
    return connection;
  }
}
function createClient() {
  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = FULL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.close();
  return new PrismaClient({ adapter: new ConfiguredAdapter({ url: `file:${databasePath}`, timeout: 5000 }) });
}
export const db = globalDb.kipDb ?? createClient();
globalDb.kipDb = db;
