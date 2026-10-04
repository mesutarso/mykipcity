import {queueMail} from "./mail";
import {accessVerification,activeParcelWhere,accessStatus,declaredQuality,type AccessVerification} from "./parcel-access-model";
import type {Prisma} from "@/generated/prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "./db";
import {identityDetails,parcelDetails,documentDetails,readParcel} from "./dossier-model";

export class WorkflowError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function getActor(userId: string) {
  const actor = await db.user.findUnique({ where: { id: userId } });
  if (!actor?.active) throw new WorkflowError("Accès suspendu ou indisponible.", 403);
  return actor;
}
export async function requireStaff(userId: string) {
  const actor = await getActor(userId);
  if (actor.role !== "ACQUIRER_AGENT") throw new WorkflowError("Cette action est réservée à l’équipe acquéreurs.", 403);
  return actor;
}
export async function ownFile(userId: string, fileId?: string) {
  const actor = await getActor(userId);
  const selected = fileId ?? actor.selectedFileId ?? undefined;
  const file = await db.acquirerFile.findFirst({ where: { ...(selected ? { id: selected } : {}), acquirer: { userId } }, orderBy: { id: "asc" }, include: { acquirer: true, declarations: { include: { parcel: true }, orderBy: { reference: "asc" } }, documents: { orderBy: { createdAt: "desc" } } } });
  if (!file) throw new WorkflowError("Aucun dossier accessible.", 404);
  return {...file,declarations:file.declarations.map(p=>({...p,status:accessStatus(p),parcel:accessStatus(p)==="APPROVED"?p.parcel:null}))};
}
export async function writableFile(userId:string,fileId?:string) {
  if(!fileId&&await db.acquirerFile.count({where:{acquirer:{userId}}})>1)throw new WorkflowError("Rechargez le formulaire pour identifier le dossier à modifier.",409);
  return ownFile(userId,fileId);
}
export async function createInvitation(actorId: string, acquirerId: string) {
  await requireStaff(actorId);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  await db.$transaction(async tx => {
    const acquirer = await tx.acquirer.findUnique({ where: { id: acquirerId } });
    if (!acquirer || acquirer.userId || acquirer.mergedIntoId) throw new WorkflowError("Invitation impossible pour ce dossier.");
    await tx.invitation.updateMany({ where: { acquirerId, consumedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.invitation.create({ data: { tokenHash: tokenHash(token), acquirerId, email: acquirer.email, expiresAt } });
    await tx.auditEvent.create({ data: { actorId, action: "INVITATION_CREATED", objectId: acquirerId } });
    await tx.outboxEvent.create({ data: { type: "INVITATION", recipient: acquirer.email, objectId: acquirerId } });
    if(process.env.BETTER_AUTH_SECRET)await queueMail({key:`invitation:${tokenHash(token)}`,recipient:acquirer.email,kind:"INVITATION",subject:"Votre invitation MyKipCity",text:`Créez votre compte depuis ce lien personnel valable 72 heures :\n${process.env.BETTER_AUTH_URL}/invitation/${token}`,expiresAt},tx);
  });
  // Delivery is queued; the worker is explicitly enabled by the operator.
  return { url: `${process.env.BETTER_AUTH_URL}/invitation/${token}`, expiresAt };
}
export async function revokeInvitation(actorId: string, invitationId: string) {
  await requireStaff(actorId);
  await db.$transaction(async tx => {
    const result = await tx.invitation.updateMany({ where: { id: invitationId, consumedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    if (result.count !== 1) throw new WorkflowError("Cette invitation n’est plus active.", 409);
    await tx.auditEvent.create({ data: { actorId, action: "INVITATION_REVOKED", objectId: invitationId } });
  });
}
export async function invitationInfo(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const item = await db.invitation.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!item || item.consumedAt || item.revokedAt || item.expiresAt <= new Date()) return null;
  return { email: item.email, expiresAt: item.expiresAt };
}
const activationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/), name: z.string().trim().min(2).max(120),
  password: z.string().min(12, "Choisissez un mot de passe d’au moins 12 caractères.").max(128),
  accepted: z.literal(true, { error: "Acceptez les conditions d’accès." }),
}).strict();
export async function activateInvitation(input: unknown) {
  const value = activationSchema.parse(input);
  if (!await invitationInfo(value.token)) throw new WorkflowError("Invitation expirée, révoquée ou déjà utilisée.", 410);
  // Better Auth's own password hashing; credentials persisted atomically with invitation consumption.
  const password = await hashPassword(value.password);
  return db.$transaction(async tx => {
    const invite = await tx.invitation.findUnique({ where: { tokenHash: tokenHash(value.token) }, include: { acquirer: true } });
    const now = new Date();
    if (!invite || invite.revokedAt || invite.consumedAt || invite.expiresAt <= now || invite.acquirer.userId || invite.acquirer.mergedIntoId) throw new WorkflowError("Invitation expirée, révoquée ou déjà utilisée.", 410);
    const consumed = await tx.invitation.updateMany({ where: { id: invite.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (consumed.count !== 1) throw new WorkflowError("Cette invitation vient d’être utilisée.", 409);
    const userId = randomUUID();
    await tx.user.create({ data: {
      id: userId, name: value.name, email: invite.email, emailVerified: true, personId: invite.acquirer.personId,
      accounts: { create: { id: randomUUID(), accountId: userId, providerId: "credential", password } },
    } });
    await tx.acquirer.update({ where: { id: invite.acquirerId }, data: { userId } });
    await tx.acquirerFile.create({ data: { acquirerId: invite.acquirerId, fullName: value.name } });
    await tx.auditEvent.create({ data: { actorId: userId, action: "ACCOUNT_ACTIVATED", objectId: invite.acquirerId, detail: "Conditions de préproduction v2 acceptées" } });
    return { email: invite.email };
  });
}
export const dossierSchema = z.object({
  fileId: z.string().min(1).optional(),
  version: z.number().int().nonnegative(),
  fullName: z.string().trim().min(2, "Indiquez votre nom complet.").max(120),
  phone: z.string().trim().max(30), city: z.string().trim().max(100), country: z.string().trim().max(100),
  details: identityDetails.optional(),
  parcels: z.array(z.object({ details:parcelDetails.optional(), reference: z.string().trim().min(1).max(60), contractNumber: z.string().trim().max(80) }).strict()).min(1).max(10),
}).strict();
export async function saveDossier(userId: string, input: unknown) {
  const value = dossierSchema.parse(input);
  const file = await writableFile(userId, value.fileId);
  if(value.details&&file.declarations.some(p=>p.status==="APPROVED")&&(identityDetails.parse(value.details).quality!==identityDetails.parse(file.details??{}).quality||identityDetails.parse(value.details).holderName!==identityDetails.parse(file.details??{}).holderName))throw new WorkflowError("Demandez le réexamen des droits avant de changer de titulaire ou de qualité.",409);
  const refs = value.parcels.map(p => p.reference.toUpperCase());
  if (new Set(refs).size !== refs.length) throw new WorkflowError("Une parcelle figure plusieurs fois dans le dossier.");
  if (!["DRAFT", "NEEDS_INFO"].includes(file.status)) throw new WorkflowError("Ce dossier est en cours d’examen ou déjà traité.", 409);
  await db.$transaction(async tx => {
    const currentActor=await tx.user.findUnique({where:{id:userId}});
    if(!currentActor?.active||currentActor.role!=="ACQUIRER")throw new WorkflowError("Accès suspendu ou modifié.",403);
    const changed = await tx.acquirerFile.updateMany({ where: { id: file.id, acquirer: { userId }, version: value.version, status: { in: ["DRAFT", "NEEDS_INFO"] } }, data: {
      fullName: value.fullName, phone: value.phone, country: value.country, city: value.city, ...(value.details?{details:value.details}:{}), version: { increment: 1 },
    } });
    if (changed.count !== 1) throw new WorkflowError("Le dossier a changé. Rechargez la page avant de continuer.", 409);
    // Preserve decisions; this demo only allows changing still-pending declarations after a complement.
    const locked = file.declarations.filter(p => p.status !== "PENDING");
    for (const declared of locked) {
      const next = value.parcels.find(p => p.reference.toUpperCase() === declared.reference);
      if (!next || next.contractNumber !== declared.contractNumber || (next.details&&JSON.stringify(next.details)!==JSON.stringify(readParcel(declared.details)))) throw new WorkflowError("Une parcelle déjà examinée ne peut pas être modifiée ici.", 409);
    }
    await tx.parcelDeclaration.deleteMany({ where: { fileId: file.id, status: "PENDING", reference: { notIn: refs } } });
    for (const [i, parcel] of value.parcels.entries()) {
      if (locked.some(p => p.reference === refs[i])) continue;
      // Merely declaring a reference conveys no registry information or access.
      await tx.parcelDeclaration.upsert({where:{fileId_reference:{fileId:file.id,reference:refs[i]}},update:{contractNumber:parcel.contractNumber,...(parcel.details?{details:parcel.details}:{})},create:{fileId:file.id,reference:refs[i],contractNumber:parcel.contractNumber,...(parcel.details?{details:parcel.details}:{})}});
    }
    await tx.auditEvent.create({ data: { actorId: userId, action: "DOSSIER_SAVED", objectId: file.id, detail:JSON.stringify({version:value.version+1,identity:value.details??file.details,declarations:value.parcels}) } });
  });
}
export async function submitDossier(userId: string, version: number, fileId?: string) {
  const file = await writableFile(userId, fileId);
  if (!file.phone || !file.city || !file.country || !file.declarations.length || (!file.documents.some(d=>d.isCurrent)&&!file.declarations.every(p=>readParcel(p.details).missingContract))) throw new WorkflowError("Complétez vos coordonnées, déclarez une parcelle et déposez un contrat.");
  if(file.details){
    const identity=identityDetails.parse(file.details);
    if(!identity.lastName||!identity.holderName||!identity.address)throw new WorkflowError("Complétez le nom, le titulaire du contrat et l’adresse de résidence.");
    for(const parcel of file.declarations){
      const detail=readParcel(parcel.details);
      if(!detail.holders)throw new WorkflowError(`Indiquez le ou les titulaires de ${parcel.reference}.`);
      if(!detail.missingContract&&!file.documents.some(doc=>{if(!doc.isCurrent)return false;const d=documentDetails.safeParse(doc.details);return d.success&&["ACQUISITION","LEASE","LAND_ACT","AMENDMENT"].includes(d.data.category)&&d.data.parcelReferences.includes(parcel.reference);}))throw new WorkflowError(`Associez une copie contractuelle à ${parcel.reference}, ou demandez de l’aide pour retrouver le contrat.`);
    }
  }
  await db.$transaction(async tx => {
    const currentActor=await tx.user.findUnique({where:{id:userId}});
    if(!currentActor?.active||currentActor.role!=="ACQUIRER")throw new WorkflowError("Accès suspendu ou modifié.",403);
    const changed = await tx.acquirerFile.updateMany({ where: { id: file.id, acquirer: { userId }, version, status: { in: ["DRAFT", "NEEDS_INFO"] } }, data: { status: "SUBMITTED", submittedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new WorkflowError("Ce dossier est déjà transmis ou a changé. Rechargez la page.", 409);
    await tx.auditEvent.create({ data: { actorId: userId, action: "DOSSIER_SUBMITTED", objectId: file.id, detail: "Déclaration de bonne foi confirmée" } });
    await tx.outboxEvent.create({ data: { type: "DOSSIER_SUBMITTED", recipient: "equipe-acquereurs", objectId: file.id } });
  });
}
const reviewSchema = z.object({
  access:accessVerification.optional(),
  registryReference:z.string().trim().max(60).optional(),
  declarationId: z.string(), version: z.number().int(), decision: z.enum(["APPROVED", "REJECTED", "NEEDS_INFO"]),
  reason: z.string().trim().min(8, "Précisez le motif de la décision (8 caractères minimum).").max(1000),
  checkedDocuments: z.literal(true, { error: "Confirmez l’examen des pièces." }),
}).strict();
export async function reviewDeclaration(actorId: string, input: unknown) {
  await requireStaff(actorId);
  const value = reviewSchema.parse(input);
  await db.$transaction(async tx => {
    const actor=await tx.user.findUnique({where:{id:actorId}});if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Accès réservé à l’équipe acquéreurs.",403);
    const declared = await tx.parcelDeclaration.findUnique({ where: { id: value.declarationId }, include: { file: { include: { documents: true, acquirer: true } } } });
    if (!declared || declared.status !== "PENDING" || declared.file.status !== "SUBMITTED") throw new WorkflowError("Cette déclaration n’est pas à examiner.", 409);
    if(value.decision==="APPROVED"&&declared.file.details){
      const evidence=declared.file.documents.some(doc=>{if(!doc.isCurrent)return false;const d=documentDetails.safeParse(doc.details);return d.success&&["ACQUISITION","LEASE","LAND_ACT","AMENDMENT"].includes(d.data.category)&&d.data.parcelReferences.includes(declared.reference);});
      if(!evidence)throw new WorkflowError("Une copie contractuelle associée à cette parcelle doit être examinée avant validation.");
    }else if(value.decision==="APPROVED"&&!declared.file.documents.some(d=>d.isCurrent))throw new WorkflowError("Aucun contrat à examiner.");
    const matched = await tx.parcel.findUnique({ where: { reference: value.registryReference?.toUpperCase()||declared.reference } });
    if (value.decision === "APPROVED" && !matched) throw new WorkflowError("Cette référence ne figure pas au registre. Vérifiez la référence ou demandez un complément.");
    const permission=value.decision==="APPROVED"?await verifyParcelAccess(tx,declared.id,matched!.id,value.access):null;
    const changed = await tx.acquirerFile.updateMany({ where: { id: declared.fileId, version: value.version, status: "SUBMITTED" }, data: { version: { increment: 1 } } });
    if (changed.count !== 1) throw new WorkflowError("Une autre décision a modifié ce dossier. Rechargez.", 409);
    await tx.parcelDeclaration.update({ where: { id: declared.id }, data: {
      ...(permission?{accessVerification:permission.record,accessExpiresAt:permission.expiresAt,accessRevokedAt:null}:{}),
      status: value.decision === "NEEDS_INFO" ? "PENDING" : value.decision,
      parcelId: value.decision === "APPROVED" ? matched!.id : null,
      reason: value.reason, reviewedBy: actorId, reviewedAt: new Date(),
    } });
    const all = await tx.parcelDeclaration.findMany({ where: { fileId: declared.fileId } });
    const status = value.decision === "NEEDS_INFO" ? "NEEDS_INFO" : all.some(p => p.status === "PENDING") ? "SUBMITTED" : all.some(p => p.status === "APPROVED") ? "VERIFIED" : "CLOSED";
    await tx.acquirerFile.update({ where: { id: declared.fileId }, data: { status } });
    await tx.auditEvent.create({ data: { actorId, action: `PARCEL_${value.decision}`, objectId: declared.fileId, detail: `${declared.reference}${value.decision==="APPROVED"&&matched?` → ${matched.reference}`:""} : ${value.reason}` } });
    if(permission)await tx.auditEvent.create({data:{actorId,objectId:declared.fileId,action:"PARCEL_ACCESS_GRANTED",detail:JSON.stringify({declarationId:declared.id,parcelId:matched!.id,permission:permission.record,expiresAt:permission.expiresAt})}});
    await tx.outboxEvent.create({ data: { type: "PARCEL_DECISION", recipient: declared.file.acquirer.email, objectId: declared.fileId } });
  });
}
export async function accessibleDocument(userId: string, id: string) {
  const actor = await getActor(userId);
  const document = await db.document.findUnique({ where: { id }, include: { file: { include: { acquirer: true } } } });
  if (!document || (actor.role !== "ACQUIRER_AGENT" && document.file.acquirer.userId !== actor.id)) throw new WorkflowError("Document inaccessible.", 404);
  return document;
}

export async function verifyParcelAccess(tx:Prisma.TransactionClient,declarationId:string,parcelId:string,value?:AccessVerification){
 const declared=await tx.parcelDeclaration.findUniqueOrThrow({where:{id:declarationId},include:{file:{include:{documents:true}}}});
 const quality=declaredQuality(declared.file.details,declared.details);
 const others=await tx.parcelDeclaration.count({where:{parcelId,fileId:{not:declared.fileId},...activeParcelWhere()}});
 if(!value){if(quality!=="HOLDER"||others)throw new WorkflowError("Ce rattachement nécessite un examen de l’équipe : qualité, justificatifs et droits partagés.",409);return null;}
 if(value.quality!==quality)throw new WorkflowError("La qualité vérifiée doit correspondre à la déclaration. Demandez une correction si nécessaire.");
 if(others&&(quality==="HOLDER"?(declared.status!=="APPROVED"||!!declared.accessRevokedAt||!!(declared.accessExpiresAt&&declared.accessExpiresAt<=new Date())):!value.sharedChecked))throw new WorkflowError("Un rattachement existe déjà. Examinez la cotitularité ou le mandat sans remplacer le titulaire.",409);
 if(quality==="REPRESENTATIVE"&&(!value.principal||!value.expiresOn))throw new WorkflowError("Indiquez le titulaire représenté et la date de fin du mandat.");
 const expiresAt=value.expiresOn?new Date(`${value.expiresOn}T23:00:00.000Z`):null;
 // End of the selected date in Kinshasa (UTC+1), exclusive boundary.
 if(expiresAt&&expiresAt<=new Date())throw new WorkflowError("La date de fin des droits est déjà dépassée.");
 let proofs:{id:string;sha256:string;revision:number;page:number}[]=[];
 if(value.proofId.startsWith("member:")){
  const proof=await tx.memberDocumentVersion.findUnique({where:{id:value.proofId.slice(7)},include:{document:{include:{versions:{orderBy:{revision:"desc"},take:1}}}}});
  if(!proof||proof.document.fileId!==declared.fileId||proof.document.closedAt||proof.document.versions[0]?.id!==proof.id||!["ACCEPTED","DELIVERED"].includes(proof.status)||!(proof.document.parcelReferences as string[]).includes(declared.reference))throw new WorkflowError("Choisissez une pièce actuelle, contrôlée et associée à cette parcelle dans ce dossier.");
  if(quality==="REPRESENTATIVE"&&proof.document.category!=="MANDATE")throw new WorkflowError("Sélectionnez un mandat de représentation contrôlé.");
  proofs=[{id:value.proofId,sha256:proof.sha256,revision:proof.revision,page:1}];
 }else{
  const proof=declared.file.documents.find(d=>d.id===value.proofId&&d.isCurrent);
  const details=proof?documentDetails.safeParse(proof.details):null;
  if(!proof||!details?.success||!details.data.parcelReferences.includes(declared.reference))throw new WorkflowError("Choisissez une pièce actuelle de ce dossier associée à cette parcelle.");
  if(quality==="REPRESENTATIVE"&&details.data.category!=="MANDATE")throw new WorkflowError("Sélectionnez une pièce classée comme mandat de représentation.");
  proofs=declared.file.documents.filter(d=>d.isCurrent&&(proof.groupId?d.groupId===proof.groupId&&d.revision===proof.revision:d.id===proof.id)).map(d=>({id:d.id,sha256:d.sha256,revision:d.revision,page:d.page}));
 }
 return {expiresAt,record:{...value,scope:"PARCEL_INFORMATION_AND_OWN_FILE",proofs,verifiedAt:new Date().toISOString()}};
}
