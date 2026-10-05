import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("Scénario : comptes, pièces privées, circuits métier et redémarrage sans réinitialisation", async () => {
  const root = mkdtempSync(join(tmpdir(), "kip-showcase-"));
  process.env.DATABASE_URL = `file:${root}/database.sqlite`;
  process.env.DOCUMENTS_DIR = `${root}/documents`;
  process.env.DEMO_MODE = "true";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3200";
  process.env.BETTER_AUTH_SECRET = "isolated-showcase-test-secret-minimum-32-characters";
  process.env.MAIL_ENABLED = "false";
  const run = (args: string[]) => execFileSync(process.execPath, args, { env: process.env, stdio: "pipe" }).toString();
  let disconnect: (() => Promise<void>) | undefined;
  try {
    run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
    const output = run(["--import", "tsx", "scripts/seed-showcase.ts"]);
    const { db } = await import("../src/lib/db");
    disconnect = () => db.$disconnect();
    const { memberFinance } = await import("../src/lib/member-finance");
    const { accessibleDocument } = await import("../src/lib/workflow");
    const { verifyPassword } = await import("better-auth/crypto");
    assert.equal(await db.user.count(), 10);
    assert.equal(await db.acquirer.count(), 3);
    assert.equal(await db.parcelDeclaration.count({ where: { status: "APPROVED" } }), 2);
    assert.equal(await db.parcelDeclaration.count({ where: { status: "PENDING" } }), 1);
    assert.equal(await db.financeCase.count(), 3);
    assert.equal(await db.financeRevision.count(), 6);
    assert.equal(await db.memberPublication.count({ where: { status: "PUBLISHED" } }), 2);
    assert.equal((await memberFinance("mykipcity-showcase-v1-julien")).length, 1);
    assert.equal((await memberFinance("mykipcity-showcase-v1-alain")).length, 0);
    const accessPath = join(root, "showcase-access.json");
    const access = readFileSync(accessPath, "utf8");
    const credentials = JSON.parse(access);
    assert.equal(statSync(accessPath).mode & 0o777, 0o600);
    const account = await db.account.findFirstOrThrow({ where: { userId: "mykipcity-showcase-v1-julien" } });
    assert.ok(await verifyPassword({ password: credentials.passwords.julien, hash: account.password! }));
    assert.ok(!output.includes(credentials.passwords.julien));
    const doc = await db.document.findFirstOrThrow({ where: { fileId: "mykipcity-showcase-v1-julien-file" } });
    assert.equal((await accessibleDocument("mykipcity-showcase-v1-julien", doc.id)).id, doc.id);
    await assert.rejects(accessibleDocument("mykipcity-showcase-v1-claire", doc.id));
    const auditCount = await db.auditEvent.count();
    await db.user.update({ where: { id: "mykipcity-showcase-v1-julien" }, data: { name: "Profil modifié en recette" } });
    run(["--import", "tsx", "scripts/seed-showcase.ts"]);
    assert.equal(await db.user.count(), 10);
    assert.equal(await db.auditEvent.count(), auditCount);
    assert.equal(readFileSync(accessPath, "utf8"), access);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: "mykipcity-showcase-v1-julien" } })).name, "Profil modifié en recette");
    assert.equal((await db.account.findUniqueOrThrow({ where: { id: account.id } })).password, account.password);
  } finally {
    await disconnect?.();
    rmSync(root, { recursive: true, force: true });
  }
});
