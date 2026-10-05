import "dotenv/config";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { parseSeedUsers } from "./seed-users-model";

async function main() {
  const inputFile = process.env.SEED_USERS_FILE;
  if (!inputFile) throw new Error("Configurer SEED_USERS_FILE vers un fichier JSON privé.");
  const users = parseSeedUsers(JSON.parse(readFileSync(inputFile, "utf8")), process.env.DEMO_MODE === "true");
  const prepared = await Promise.all(users.map(async (user) => ({
    ...user, password: await hashPassword(user.password),
  })));
  const created = await db.$transaction(async (tx) => {
    let count = 0;
    for (const user of prepared) {
      const existing = await tx.user.findUnique({ where: { email: user.email } });
      if (existing) continue;
      const id = randomUUID();
      await tx.user.create({ data: {
        id, name: user.name, email: user.email, role: user.role, personId: randomUUID(),
        accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: user.password } },
      } });
      await tx.auditEvent.create({ data: {
        actorId: id, action: "STAFF_BOOTSTRAPPED", objectId: id,
        detail: "Création initiale du collaborateur depuis la configuration privée du serveur.",
      } });
      count++;
    }
    return count;
  });
  console.log(`Initialisation : ${created} compte(s) créé(s), ${prepared.length - created} compte(s) existant(s) conservé(s).`);
}

main().catch(() => {
  console.error("Initialisation des utilisateurs échouée. Vérifier le fichier privé, les migrations et la configuration ; aucune valeur sensible n’est affichée.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
