import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

test("SQLite : initialisation WAL pendant qu’un autre processus retient un verrou", async () => {
  const root = mkdtempSync(join(tmpdir(), "kip-sqlite-startup-"));
  const path = join(root, "database.sqlite");
  const connection = new Database(path);
  connection.exec("CREATE TABLE lock_test (id INTEGER); INSERT INTO lock_test VALUES (1); BEGIN; SELECT * FROM lock_test;");
  try {
    const child = spawn(process.execPath, ["--import", "tsx", "-e", "import('./src/lib/db.ts').then(({db})=>db.$disconnect()).catch(e=>{console.error(e.code || e.message);process.exit(1)})"], {
      env: { ...process.env, DATABASE_URL: `file:${path}`, DEMO_MODE: "true" }, stdio: ["ignore", "pipe", "pipe"],
    });
    let error = "";
    child.stderr.on("data", chunk => { error += chunk.toString(); });
    const timer = setTimeout(() => connection.exec("COMMIT"), 750);
    const code = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
    clearTimeout(timer);
    assert.equal(code, 0, error);
    const check = new Database(path);
    try { assert.equal(check.pragma("journal_mode", { simple: true }), "wal"); }
    finally { check.close(); }
  } finally {
    connection.close();
    rmSync(root, { recursive: true, force: true });
  }
});
