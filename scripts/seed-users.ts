import "dotenv/config";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "../src/lib/db";
import { staffRoles } from "../src/lib/roles";

const userSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.email().trim().toLowerCase().refine(
    (email) => !email.endsWith(".test") && !email.endsWith(".invalid"),
    "Utiliser une adresse réelle pour l’initialisation des collaborateurs.",
  ),
  role: z.enum(Object.keys(staffRoles) as [keyof typeof staffRoles, ...(keyof typeof staffRoles)[]]),
  password: z.string().min(16).max(128),
}).strict();
const usersSchema = z.array(userSchema).min(1).max(100).superRefine((users, ctx) => {
  if (new Set(users.map((user) => user.email)).size !== users.length) {
    ctx.addIssue({ code: "custom", message: "Les adresses e-mail doivent être uniques." });
  }
});

async function main() {
  const inputFile = process.env.SEED_USERS_FILE;
  if (!inputFile) throw new Error("Configurer SEED_USERS_FILE vers un fichier JSON privé.");
  const parsed = usersSchema.safeParse(JSON.parse(readFileSync(inputFile, "utf8")));
  if (!parsed.success) {
    // Do not print input values or Zod errors that may include credentials.
    throw new Error("Fichier utilisateurs invalide : vérifier noms, adresses, rôles, mots de passe (16 caractères minimum) et doublons.");
  }
  const prepared = await Promise.all(parsed.data.map(async (user) => ({
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
