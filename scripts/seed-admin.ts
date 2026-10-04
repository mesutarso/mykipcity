import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
async function main() {
  const id = "demo-admin";
  await db.user.upsert({ where: { email: "admin@demo.kipcity.test" }, update: {}, create: { id, name: "Administration Kip-City", email: "admin@demo.kipcity.test", personId: "person-demo-admin", role: "ADMIN", accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword("Demo-Admin-2026!") } } } });
  console.log("Compte local : admin@demo.kipcity.test / Demo-Admin-2026!");
}
main().finally(() => db.$disconnect());
