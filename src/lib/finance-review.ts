import { reopeningActions } from "./finance-reopening";
import { opportunitySchema, opportunityDocuments, opportunityReady } from "./opportunity-model";
import { z } from "zod";
import { db } from "./db";
import { getActor, WorkflowError } from "./workflow";
import { requestSchema, budgetSchema } from "./finance-model";
import type { Prisma } from "@/generated/prisma/client";
const caseCommand = { id: z.string().min(1), version: z.number().int().positive() };
export const reviewActions: Record<string, string> = { ...reopeningActions, REPLACE_REVIEWER:"Contrôleur remplacé", REPLACE_VALIDATOR:"Validateur remplacé", SUBMIT: "Soumis au contrôle", CONTROL: "Contrôle favorable", VALIDATE: "Validation interne", RETURN: "Corrections demandées", WITHDRAW: "Retiré du circuit" };
export async function submitReview(userId: string, input: unknown) {
 const v = z.object({ ...caseCommand, reviewerId: z.string().min(1), validatorId: z.string().min(1) }).strict().parse(input);
 return db.$transaction(async tx => {
  const actor = await tx.user.findUnique({ where: { id: userId } });
  if (!actor?.active || actor.role !== "FINANCE_OFFICER") throw new WorkflowError("Accès réservé au référent Finance.",403);
  const item = await tx.financeCase.findFirst({ where: { id: v.id, ownerId: userId, status: "DRAFT", version: v.version }, include: { revisions: true, requirements: { include: { documents: true } }, offers: { include: { revisions: true } } } });
  if (!item) throw new WorkflowError("Dossier inaccessible, modifié ou déjà soumis.",409);
  const request = requestSchema.parse(item.request); const budget = budgetSchema.safeParse(item.budget);
  if (!request.project || !request.requested || !budget.success) throw new WorkflowError("Complétez le projet, le montant recherché et le budget avant de soumettre.");
  if (!item.requirements.length || item.requirements.some(r => !r.documents.some(d => d.revision === r.version && d.status === "ACCEPTED"))) throw new WorkflowError("Toutes les pièces attendues doivent disposer d’une version contrôlée. Ajoutez au moins une pièce.");
  const currentDocuments=new Set(item.requirements.flatMap(r=>r.documents.filter(d=>d.revision===r.version&&d.status==="ACCEPTED").map(d=>d.id)));
  if(item.offers.some(o=>{const data=o.data as {documentId?:string};return data.documentId&&!currentDocuments.has(data.documentId);}))throw new WorkflowError("Une offre référence une pièce remplacée ou non contrôlée. Mettez son justificatif à jour.");
  const opportunity=item.opportunity?opportunitySchema.parse(item.opportunity):null;
  if(opportunity&&!opportunityReady(opportunity))throw new WorkflowError("Complétez l’étude d’opportunité, les avis, les visas et les deux vérifications avant de soumettre.");
  if(opportunity&&opportunityDocuments(opportunity).some(id=>!currentDocuments.has(id)))throw new WorkflowError("Un justificatif de l’étude a été remplacé ou n’est plus contrôlé. Actualisez l’étude.");
  const authorIds = new Set([userId, ...item.revisions.map(r => r.actorId), ...item.offers.flatMap(o => o.revisions.map(r => r.actorId)), ...item.requirements.flatMap(r => r.documents.flatMap(d => [d.uploadedBy, ...(d.reviewedBy ? [d.reviewedBy] : [])]))]);
  const people = await tx.user.findMany({ where: { id: { in: [...authorIds] } }, select: { personId: true } });
  const preparerPeople = [...new Set(people.map(p => p.personId))];
  const reviewer = await tx.user.findUnique({ where: { id: v.reviewerId } }); const validator = await tx.user.findUnique({ where: { id: v.validatorId } });
  if (!reviewer?.active || reviewer.role !== "FINANCE_REVIEWER" || !validator?.active || validator.role !== "FINANCE_VALIDATOR") throw new WorkflowError("Choisissez un contrôleur et un validateur actifs.");
  if (reviewer.personId === validator.personId || preparerPeople.includes(reviewer.personId) || preparerPeople.includes(validator.personId)) throw new WorkflowError("Préparation, contrôle et validation doivent être assurés par trois personnes distinctes.",403);
  const cycle = item.reviewCycle + 1;
  const changed = await tx.financeCase.updateMany({ where: { id: item.id, ownerId: userId, status: "DRAFT", version: v.version }, data: { status: "IN_REVIEW", reviewerId: reviewer.id, validatorId: validator.id, reviewCycle: cycle, version: { increment: 1 } } });
  if (changed.count !== 1) throw new WorkflowError("Le dossier a changé. Rechargez la page.",409);
  const snapshot = JSON.parse(JSON.stringify({ reference: item.reference, applicantName: item.applicantName, request, budget: budget.data, opportunity, preparer: { id: actor.id, name: actor.name }, reviewer: { id: reviewer.id, name: reviewer.name }, validator: { id: validator.id, name: validator.name }, documents: item.requirements.map(r => { const d = r.documents.find(d => d.revision === r.version)!; return { id: d.id, label: r.label, name: d.originalName, revision: d.revision, sha256: d.sha256, reason: d.reason }; }), offers: item.offers.map(o => ({ id: o.id, version: o.version, institution: o.institutionSnapshot, data: o.data })) })) as Prisma.InputJsonValue;
  await tx.financeReview.create({ data: { caseId: item.id, cycle, snapshot, preparerPeople } });
  await tx.financeReviewEvent.create({ data: { caseId: item.id, cycle, actorId: actor.id, actorName: actor.name, actorPersonId: actor.personId, action: "SUBMIT", reason: "Dossier soumis au contrôle interne." } });
  return { success: true };
 });
}
export async function decideReview(userId: string, input: unknown) {
 const v = z.object({ ...caseCommand, action: z.enum(["CONTROL","VALIDATE","RETURN","WITHDRAW"]), reason: z.string().trim().min(10,"Précisez votre décision (10 caractères minimum).").max(2000), checks: z.object({ identity: z.boolean(), budget: z.boolean(), documents: z.boolean() }).strict().optional() }).strict().parse(input);
 return db.$transaction(async tx => {
  const actor = await tx.user.findUnique({ where: { id: userId } }); if (!actor?.active) throw new WorkflowError("Accès suspendu.",403);
  const item = await tx.financeCase.findUnique({ where: { id: v.id } });
  if (!item || item.version !== v.version) throw new WorkflowError("Dossier inaccessible ou modifié.",409);
  const owner = actor.role === "FINANCE_OFFICER" && actor.id === item.ownerId;
  const reviewer = actor.role === "FINANCE_REVIEWER" && actor.id === item.reviewerId && item.status === "IN_REVIEW";
  const validator = actor.role === "FINANCE_VALIDATOR" && actor.id === item.validatorId && item.status === "IN_VALIDATION";
  if (v.action === "WITHDRAW" ? !owner || !["IN_REVIEW","IN_VALIDATION"].includes(item.status) : !(reviewer || validator)) throw new WorkflowError("Cette décision ne vous est pas attribuée.",403);
  if (v.action === "CONTROL" && !reviewer || v.action === "VALIDATE" && !validator) throw new WorkflowError("Étape de validation incorrecte.",409);
  const cycle = await tx.financeReview.findUniqueOrThrow({ where: { caseId_cycle: { caseId: item.id, cycle: item.reviewCycle } } });
  if (v.action !== "WITHDRAW") {
   const prepared = cycle.preparerPeople as string[];
   const ownerPerson = await tx.user.findUniqueOrThrow({ where: { id: item.ownerId }, select: { personId: true } });
   if (prepared.includes(actor.personId) || ownerPerson.personId === actor.personId) throw new WorkflowError("Vous avez participé à la préparation de ce dossier.",403);
   if (v.action === "VALIDATE") {
    const control = await tx.financeReviewEvent.findFirst({ where: { caseId: item.id, cycle: item.reviewCycle, action: "CONTROL" } });
    if (!control || control.actorPersonId === actor.personId) throw new WorkflowError("Un contrôle préalable par une autre personne est nécessaire.",403);
   }
  }
  if (v.action === "CONTROL" && (!v.checks?.identity || !v.checks.budget || !v.checks.documents)) throw new WorkflowError("Confirmez les trois points du contrôle ou demandez des corrections.");
  const status = v.action === "CONTROL" ? "IN_VALIDATION" : v.action === "VALIDATE" ? "INTERNALLY_VALIDATED" : "DRAFT";
  const changed = await tx.financeCase.updateMany({ where: { id: item.id, version: v.version, status: item.status }, data: { status, version: { increment: 1 } } });
  if (changed.count !== 1) throw new WorkflowError("Une décision vient d’être enregistrée. Rechargez.",409);
  await tx.financeReviewEvent.create({ data: { caseId: item.id, cycle: item.reviewCycle, actorId: actor.id, actorName: actor.name, actorPersonId: actor.personId, action: v.action, reason: v.reason } });
  return { success: true };
 });
}
export async function controlledCase(userId: string, id: string) {
 const actor = await getActor(userId);
 if (!["FINANCE_REVIEWER","FINANCE_VALIDATOR"].includes(actor.role)) throw new WorkflowError("Accès réservé au contrôle Finance.",403);
 const item = await db.financeCase.findFirst({ where: { id, ...(actor.role === "FINANCE_REVIEWER" ? { reviewerId:userId } : { validatorId:userId }), status: { in:["IN_REVIEW","IN_VALIDATION","INTERNALLY_VALIDATED"] } } });
 if (!item) throw new WorkflowError("Dossier inaccessible.",404);
 return item;
}
