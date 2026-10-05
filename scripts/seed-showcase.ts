import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { documentDetails } from "../src/lib/dossier-model";
import { reviewDeclaration } from "../src/lib/workflow";
import { createFinanceCase, saveFinanceForm } from "../src/lib/finance";
import { manageMemberUpdate } from "../src/lib/member-finance";
import { changePublication } from "../src/lib/publications";
import { saveInstitution } from "../src/lib/institutions";

const scenario = "mykipcity-showcase-v1";
const people = [
  ["admin", "Sarah Ilunga", "ADMIN"],
  ["gestion", "Patrick Kabeya", "ACQUIRER_AGENT"],
  ["relecture", "Esther Mbuyi", "ACQUIRER_AGENT"],
  ["finance", "David Kanku", "FINANCE_OFFICER"],
  ["controle", "Nadia Tshibanda", "FINANCE_REVIEWER"],
  ["validation", "Marc Kalala", "FINANCE_VALIDATOR"],
  ["juridique", "Aline Mukendi", "LEGAL_OFFICER"],
  ["julien", "Julien Mutombo", "ACQUIRER"],
  ["claire", "Claire Kasongo", "ACQUIRER"],
  ["alain", "Alain Mwamba", "ACQUIRER"],
] as const;
const clients = [
  { key: "julien", name: "Julien Mutombo", reference: "KPC-2026-001", parcel: "AC-A014", area: 900, city: "Lubumbashi", verified: true, cost: "68000", contribution: "18000" },
  { key: "claire", name: "Claire Kasongo", reference: "KPC-2026-002", parcel: "AC-A028", area: 750, city: "Kipushi", verified: true, cost: "52000", contribution: "12000" },
  { key: "alain", name: "Alain Mwamba", reference: "KPC-2026-003", parcel: "MI-B006", area: 1000, city: "Kinshasa", verified: false, cost: "85000", contribution: "25000" },
] as const;
const id = (key: string) => `${scenario}-${key}`;
const email = (key: string) => `${key}@recette.kipcity.test`;

async function configureShowcasePassword(password: string) {
  const root = resolve(process.env.DOCUMENTS_DIR ?? "./data/documents");
  const accessPath = resolve(dirname(root), "showcase-access.json");
  await mkdir(dirname(accessPath), { recursive: true });
  const hash = await hashPassword(password);
  await db.$transaction(async tx => {
    for (const [key] of people) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: id(key) } });
      if (user.email !== email(key)) throw new Error("Identité du compte de recette modifiée ; réinitialisation refusée.");
      const account = await tx.account.findUniqueOrThrow({ where: { id: `${id(key)}-credential` } });
      if (account.password && await verifyPassword({ password, hash: account.password })) continue;
      await tx.account.update({ where: { id: account.id }, data: { password: hash } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.auditEvent.create({ data: { actorId: id("admin"), objectId: user.id, action: "SHOWCASE_PASSWORD_CONFIGURED", detail: "Mot de passe des tests configuré depuis l’environnement privé." } });
    }
  });
  const temporary = `${accessPath}.tmp`;
  await writeFile(temporary, JSON.stringify({ scenario, passwords: Object.fromEntries(people.map(([key]) => [key, password])), accounts: people.map(([key, name, role]) => ({ name, email: email(key), role, passwordKey: key })) }, null, 2), { mode: 0o600 });
  await rename(temporary, accessPath);
}

async function main() {
  if (process.env.DEMO_MODE !== "true") throw new Error("Le scénario exige DEMO_MODE=true.");
  const configuredPassword = process.env.SEED_SHOWCASE_PASSWORD;
  if (configuredPassword && (configuredPassword.length < 12 || configuredPassword.length > 128)) throw new Error("Le mot de passe des tests doit comporter 12 à 128 caractères.");
  if (await db.auditEvent.findFirst({ where: { action: "SHOWCASE_INITIALIZED", objectId: scenario } })) {
    if (configuredPassword) await configureShowcasePassword(configuredPassword);
    console.log("Scénario MyKipCity déjà initialisé ; données et accès conservés.");
    return;
  }
  const root = resolve(process.env.DOCUMENTS_DIR ?? "./data/documents");
  const accessPath = resolve(dirname(root), "showcase-access.json");
  await mkdir(dirname(accessPath), { recursive: true });
  let passwords: Record<string, string>;
  try {
    passwords = JSON.parse(await readFile(accessPath, "utf8")).passwords;
    if (!passwords || people.some(([key]) => typeof passwords[key] !== "string" || passwords[key].length < 16)) throw new Error("Fichier d’accès invalide.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    passwords = Object.fromEntries(people.map(([key]) => [key, randomBytes(24).toString("base64url")]));
    await writeFile(accessPath, JSON.stringify({ scenario, passwords, accounts: people.map(([key, name, role]) => ({ name, email: email(key), role, passwordKey: key })) }, null, 2), { mode: 0o600, flag: "wx" });
  }
  for (const [key, name, role] of people) {
    const password = await hashPassword(passwords[key]);
    await db.user.upsert({ where: { id: id(key) }, update: {}, create: {
      id: id(key), name, email: email(key), role, personId: `${id(key)}-person`,
      accounts: { create: { id: `${id(key)}-credential`, accountId: id(key), providerId: "credential", password } },
    } });
  }
  const pdf = await readFile(resolve("demo/dossier-parcelle.pdf"));
  for (const client of clients) {
    await db.parcel.upsert({ where: { reference: client.parcel }, update: {}, create: { reference: client.parcel, area: client.area, cadastralReference: `KIP/${client.parcel}/2026` } });
    const acquirer = await db.acquirer.upsert({ where: { reference: client.reference }, update: {}, create: { id: id(`${client.key}-acquirer`), reference: client.reference, registeredName: client.name, email: email(client.key), personId: `${id(client.key)}-person`, userId: id(client.key) } });
    const file = await db.acquirerFile.upsert({ where: { acquirerId: acquirer.id }, update: {}, create: { id: id(`${client.key}-file`), acquirerId: acquirer.id, fullName: client.name, city: client.city, country: "République démocratique du Congo", status: "SUBMITTED", submittedAt: new Date(), contactOwnerId: id("gestion") } });
    const storageKey = `showcase/${client.key}/dossier-parcelle.pdf`;
    await mkdir(resolve(root, "showcase", client.key), { recursive: true });
    await writeFile(resolve(root, storageKey), pdf);
    const proof = await db.document.upsert({ where: { storageKey }, update: {}, create: { fileId: file.id, originalName: `Dossier-${client.parcel}.pdf`, storageKey, mimeType: "application/pdf", size: pdf.length, details: documentDetails.parse({ category: "ACQUISITION", parcelReferences: [client.parcel], observation: "Pièce du parcours de recette, sans valeur juridique" }), sha256: createHash("sha256").update(pdf).digest("hex") } });
    const declaration = await db.parcelDeclaration.upsert({ where: { fileId_reference: { fileId: file.id, reference: client.parcel } }, update: {}, create: { fileId: file.id, reference: client.parcel, contractNumber: `KPC/2026/${client.key.toUpperCase()}` } });
    if (client.verified && declaration.status === "PENDING" && file.status === "SUBMITTED") {
      await reviewDeclaration(id("gestion"), { declarationId: declaration.id, version: file.version, decision: "APPROVED", reason: "Pièce et référence examinées dans le parcours de recette.", checkedDocuments: true, access: { quality: "HOLDER", proofId: proof.id, principal: "", expiresOn: "", checked: true, sharedChecked: false } });
    }
    if (!await db.financeCase.findFirst({ where: { acquirerId: acquirer.id, ownerId: id("finance") } })) {
      const finance = await createFinanceCase(id("finance"), {
        applicantName: client.name, quality: client.verified ? "VERIFIED" : "CANDIDATE", acquirerReference: client.reference,
        phone: "", email: email(client.key), pathway: "HABITAT", need: "HABITAT", otherNeed: "",
        project: "Construction d’une maison familiale de trois chambres", description: "Projet de résidence principale avec travaux répartis en deux phases : gros œuvre puis finitions.",
        calendar: "Travaux prévus sur 12 mois après validation du budget", projectCost: client.cost, projectCurrency: "USD", contribution: client.contribution,
        contributionCurrency: "USD", requested: String(Number(client.cost) - Number(client.contribution)), requestedCurrency: "USD", situation: "USUAL_BANK",
        institution: "Établissement financier à sélectionner", contact: "Référent Finance Kip-City", nextContact: "", initialDocuments: "Dossier de parcelle ; devis et justificatifs de revenus à compléter",
      });
      await saveFinanceForm(id("finance"), { id: finance.id, version: 1, code: "FIN-F02", data: {
        situationDate: new Date().toISOString().slice(0, 10), dependents: 2,
        lines: [
          { category: "REGULAR", amount: "2400", period: "MONTH" }, { category: "VARIABLE", amount: "300", period: "MONTH" },
          { category: "ESSENTIAL", amount: "950", period: "MONTH" }, { category: "DEBT", amount: "150", period: "MONTH" },
          { category: "INSTALLMENT", amount: "650", period: "MONTH" }, { category: "WORKS", amount: client.cost, period: "ONCE" },
          { category: "FEES", amount: "1500", period: "ONCE" }, { category: "FINANCING", amount: "1000", period: "ONCE" },
          { category: "PROVISION", amount: "3500", period: "ONCE" }, { category: "RESOURCES", amount: client.contribution, period: "ONCE" },
        ].map(line => ({ ...line, currency: "USD", proof: "ESTIMATED", evidence: "Hypothèse du scénario de recette", stability: "À vérifier lors de l’instruction" })),
        installmentSource: "Hypothèse d’échéance à confronter aux conditions de l’établissement", stressScenario: "Baisse de 20 % des revenus et hausse de 10 % du coût des travaux", risks: "Devis et revenus à documenter", analystNotes: "Préparer la liste de pièces et examiner la soutenabilité du budget.",
      } });
      if (client.verified) {
        await manageMemberUpdate(id("finance"), { action: "save", caseId: finance.id, version: 0, data: {
          title: "Votre projet de construction", stage: "ACTION_REQUIRED", message: "Votre demande a été enregistrée. Pour poursuivre l’étude du budget, transmettez les éléments ci-dessous depuis votre espace documents.",
          documents: [{ label: "Devis détaillé des travaux", dueOn: "" }, { label: "Justificatifs des revenus des trois derniers mois", dueOn: "" }],
          appointmentDate: "", appointmentTime: "", appointmentPlace: "", contact: "David Kanku · Référent Finance",
        } });
        await manageMemberUpdate(id("finance"), { action: "publish", caseId: finance.id, version: 1 });
      }
    }
    if (!await db.message.findFirst({ where: { fileId: file.id, authorId: id("gestion") } })) {
      await db.message.create({ data: { fileId: file.id, authorId: id("gestion"), subject: "Bienvenue dans votre espace", body: "Bonjour, votre équipe Kip-City vous accompagne dans le suivi de votre parcelle. Vous pouvez nous écrire ici et consulter les documents de votre dossier." } });
    }
  }
  if (!await db.financeInstitution.findFirst({ where: { ownerId: id("finance"), name: "Financement Habitat Katanga" } })) {
    await saveInstitution(id("finance"), { data: { name: "Financement Habitat Katanga", branch: "Lubumbashi", contactName: "Service financement habitat", contactRole: "Chargé de clientèle", email: "habitat@recette.kipcity.test", phone: "", address: "Lubumbashi, Haut-Katanga", notes: "Institution du scénario de recette ; aucun partenariat ni taux bancaire réel n’est revendiqué." } });
  }
  for (const [title, body] of [
    ["Bienvenue dans votre espace Kip-City", "Votre espace rassemble les informations de votre parcelle, les documents et vos échanges avec l’équipe. Consultez votre profil pour vérifier vos coordonnées et activez la double authentification dans Sécurité."],
    ["Préparer votre projet de construction", "Avant de démarrer votre projet, préparez un devis détaillé, le calendrier des travaux et les justificatifs de votre apport. Votre interlocuteur Finance vous aide à organiser ces éléments et à suivre votre demande."],
  ]) {
    let publication = await db.memberPublication.findFirst({ where: { authorId: id("gestion"), title } });
    if (!publication) {
      const created = await changePublication(id("gestion"), { action: "save", version: 0, content: { title, body, audience: "MEMBERS", targetReference: "" } });
      publication = await db.memberPublication.findUniqueOrThrow({ where: { id: created.id } });
    }
    if (publication.status === "DRAFT") {
      await changePublication(id("gestion"), { action: "submit", id: publication.id, version: publication.version, reason: "Contenu prêt pour relecture." });
      publication = await db.memberPublication.findUniqueOrThrow({ where: { id: publication.id } });
    }
    if (publication.status === "IN_REVIEW") await changePublication(id("relecture"), { action: "publish", id: publication.id, version: publication.version, reason: "Contenu relu et approuvé par une seconde personne." });
  }
  await db.auditEvent.create({ data: { actorId: id("admin"), objectId: scenario, action: "SHOWCASE_INITIALIZED", detail: "Scénario de recette avec identités inventées et opérations applicatives effectives." } });
  if (configuredPassword) await configureShowcasePassword(configuredPassword);
  console.log("Scénario MyKipCity initialisé. Accès conservés dans le fichier privé showcase-access.json, à côté du dossier documents.");
}

main().catch(() => { console.error("Échec de l’initialisation du scénario ; vérifier les migrations, la configuration et les droits du volume."); process.exitCode = 1; }).finally(() => db.$disconnect());
