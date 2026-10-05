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
  const sqlite = new Database(databasePath, { timeout: 5000 });
  try {
    sqlite.pragma("busy_timeout = 5000");
    const deadline = Date.now() + 5000;
    // Changing journal mode may return the old mode or SQLITE_BUSY while another
    // process opens the same database. Retry only this startup operation.
    while (true) {
      try {
        if (sqlite.pragma("journal_mode = WAL", { simple: true }) === "wal") break;
      } catch (error) {
        if ((error as { code?: string }).code !== "SQLITE_BUSY") throw error;
      }
      if (Date.now() >= deadline) throw new Error("Impossible d’initialiser SQLite en WAL : verrou persistant.");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("synchronous = FULL");
  } finally {
    sqlite.close();
  }
  return new PrismaClient({ adapter: new ConfiguredAdapter({ url: `file:${databasePath}`, timeout: 5000 }) });
}
export const db = globalDb.kipDb ?? createClient();
globalDb.kipDb = db;
