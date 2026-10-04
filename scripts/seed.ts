import "dotenv/config";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { createInvitation } from "../src/lib/workflow";
async function main() {
  const email = "agent@demo.kipcity.test";
  const password = "Demo-KipCity-2026!";
  const id = "demo-agent";
  await db.user.upsert({ where: { email }, update: {}, create: {
    id, email, name: "Agent Démo", emailVerified: true, personId: "person-demo-agent", role: "ACQUIRER_AGENT",
    accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } },
  } });
  for (const [reference, area] of [["DEMO-A01",900],["DEMO-A02",750],["DEMO-B01",1000]] as const) {
    await db.parcel.upsert({ where: { reference }, update: {}, create: { reference, area, cadastralReference: `CAD-FICTIF-${reference}` } });
  }
  const invitations = [];
  for (const [reference, registeredName, email] of [["ACQ-DEMO-001","Camille Démo","camille@demo.kipcity.test"],["ACQ-DEMO-002","Alex Démo","alex@demo.kipcity.test"]]) {
    const acquirer = await db.acquirer.upsert({ where: { reference }, update: {}, create: { reference, registeredName, email, personId: `person-${reference}` } });
    if (!acquirer.userId) invitations.push({ reference, email, ...await createInvitation(id, acquirer.id) });
  }
  await writeFile(".demo-access.json", JSON.stringify({ agent: { email, password }, invitations }, null, 2), { mode: 0o600 });
  console.log("Données fictives prêtes. Connexion agent : agent@demo.kipcity.test / Demo-KipCity-2026!");
  console.log("Invitations à ouvrir depuis l’interface agent ou .demo-access.json. Aucun e-mail envoyé.");
}
main().finally(() => db.$disconnect());
