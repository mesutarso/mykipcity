import {queueMail} from "./mail";
import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { WorkflowError, tokenHash } from "./workflow";
const role = z.enum(["LEGAL_OFFICER", "ADMIN", "ACQUIRER_AGENT", "FINANCE_OFFICER", "FINANCE_REVIEWER", "FINANCE_VALIDATOR"]);
export async function requireAdmin(tx: Prisma.TransactionClient, id: string) {
  const actor = await tx.user.findUnique({ where: { id } });
  if (!actor?.active || actor.role !== "ADMIN") throw new WorkflowError("Accès réservé à l’administration.", 403);
}
export async function inviteStaff(actorId: string, input: unknown) {
  const value = z.object({ name: z.string().trim().min(2).max(120), email: z.email().trim().toLowerCase().max(160), role }).strict().parse(input);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600000);
  await db.$transaction(async tx => {
    await requireAdmin(tx, actorId);
    if (await tx.user.findFirst({ where: { email: value.email } }) || await tx.acquirer.findUnique({ where: { email: value.email } })) throw new WorkflowError("Cette adresse appartient déjà à un compte ou à un acquéreur.", 409);
    if (await tx.staffInvitation.findUnique({ where: { email: value.email } })) throw new WorkflowError("Une invitation existe pour cette adresse. Ouvrez-la pour renouveler le lien.", 409);
    const invite = await tx.staffInvitation.create({ data: { ...value, personId: randomUUID(), tokenHash: tokenHash(token), expiresAt } });
    await tx.auditEvent.create({ data: { actorId, action: "STAFF_INVITED", objectId: invite.id, detail: value.role } });
    if(process.env.BETTER_AUTH_SECRET)await queueMail({key:`staff-invite:${tokenHash(token)}`,recipient:value.email,kind:"INVITATION",subject:"Votre invitation Kip-City",text:`Activez votre accès personnel :\n${process.env.BETTER_AUTH_URL}/invitation-equipe/${token}`,expiresAt},tx);
  });
  return { url: `${process.env.BETTER_AUTH_URL}/invitation-equipe/${token}`, expiresAt };
}
export async function manageStaffInvitation(actorId: string, input: unknown) {
  const value = z.object({ id: z.string(), version: z.number().int(), action: z.enum(["renew", "revoke"]) }).strict().parse(input);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 3600000);
  await db.$transaction(async tx => {
    await requireAdmin(tx, actorId);
    const changed = await tx.staffInvitation.updateMany({ where: { id: value.id, version: value.version, consumedAt: null }, data: value.action === "renew" ? { tokenHash: tokenHash(token), expiresAt, revokedAt: null, version: { increment: 1 } } : { revokedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new WorkflowError("L’invitation a changé. Rechargez la page.", 409);
    await tx.auditEvent.create({ data: { actorId, action: `STAFF_INVITATION_${value.action.toUpperCase()}`, objectId: value.id } });
    if(value.action==="renew"&&process.env.BETTER_AUTH_SECRET){const invite=await tx.staffInvitation.findUniqueOrThrow({where:{id:value.id}});await queueMail({key:`staff-invite:${tokenHash(token)}`,recipient:invite.email,kind:"INVITATION",subject:"Votre nouvelle invitation Kip-City",text:`Activez votre accès personnel :\n${process.env.BETTER_AUTH_URL}/invitation-equipe/${token}`,expiresAt},tx);}
  });
  return value.action === "renew" ? { url: `${process.env.BETTER_AUTH_URL}/invitation-equipe/${token}`, expiresAt } : { success: true };
}
export async function staffInvitationInfo(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const item = await db.staffInvitation.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!item || item.consumedAt || item.revokedAt || item.expiresAt <= new Date()) return null;
  return { email: item.email, name: item.name, role: item.role };
}
export async function activateStaff(input: unknown) {
  const value = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(12).max(128), accepted: z.literal(true) }).strict().parse(input);
  if (!await staffInvitationInfo(value.token)) throw new WorkflowError("Invitation expirée, révoquée ou déjà utilisée.", 410);
  const password = await hashPassword(value.password);
  return db.$transaction(async tx => {
    const invite = await tx.staffInvitation.findUnique({ where: { tokenHash: tokenHash(value.token) } });
    const now = new Date();
    if (!invite || invite.consumedAt || invite.revokedAt || invite.expiresAt <= now) throw new WorkflowError("Invitation expirée, révoquée ou déjà utilisée.", 410);
    if (await tx.user.findUnique({ where: { email: invite.email } }) || await tx.acquirer.findUnique({ where: { email: invite.email } })) throw new WorkflowError("Cette adresse est déjà utilisée.", 409);
    const changed = await tx.staffInvitation.updateMany({ where: { id: invite.id, version: invite.version, consumedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now, version: { increment: 1 } } });
    if (changed.count !== 1) throw new WorkflowError("Invitation déjà utilisée.", 409);
    const id = randomUUID();
    await tx.user.create({ data: { id, name: invite.name, email: invite.email, personId: invite.personId, role: role.parse(invite.role), accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password } } } });
    await tx.auditEvent.create({ data: { actorId: id, action: "STAFF_ACTIVATED", objectId: id, detail: "Conditions de préproduction v2 acceptées" } });
    return { email: invite.email };
  });
}
export async function updateStaff(actorId: string, input: unknown) {
  const value = z.object({ id: z.string(), version: z.number().int().nonnegative(), role, active: z.boolean(), reason: z.string().trim().min(5, "Précisez le motif (5 caractères minimum).").max(500) }).strict().parse(input);
  await db.$transaction(async tx => {
    await requireAdmin(tx, actorId);
    if (actorId === value.id) throw new WorkflowError("Votre propre accès doit être modifié par un autre administrateur.", 403);
    const target = await tx.user.findUnique({ where: { id: value.id }, include: { acquirers: true } });
    if (!target || target.acquirers.length || !role.safeParse(target.role).success) throw new WorkflowError("Collaborateur introuvable.", 404);
    if (target.role !== value.role && await tx.financeIncident.count({where:{ownerId:target.id,status:{not:"CLOSED"}}})) throw new WorkflowError("Réattribuez les signalements en cours de ce collaborateur avant de changer son rôle.",409);
    if (target.role !== value.role && await tx.financeCase.count({where:{OR:[{reviewerId:target.id},{validatorId:target.id}],status:{in:["IN_REVIEW","IN_VALIDATION"]}}})) throw new WorkflowError("Ce collaborateur participe à un contrôle en cours. Le référent doit retirer le dossier du circuit avant de changer ce rôle.",409);
    if (target.role !== value.role && (await tx.financeCase.count({ where: { ownerId: target.id } }) || await tx.financeInstitution.count({ where: { ownerId: target.id } }))) throw new WorkflowError("Ce collaborateur gère des dossiers ou institutions Finance. Leur réattribution est nécessaire avant de changer son rôle.", 409);
    if(target.role!==value.role&&(await tx.financeCase.count({where:{legalOfficerId:target.id}})||await tx.legalRecord.count({where:{reviewerId:target.id,status:"IN_REVIEW"}})||await tx.originalEvent.count({where:{reviewerId:target.id,status:"PENDING"}})))throw new WorkflowError("Réattribuez les dossiers juridiques avant de modifier ce rôle.",409);
    const changed = await tx.user.updateMany({ where: { id: target.id, accessVersion: value.version }, data: { role: value.role, active: value.active, accessVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new WorkflowError("Les accès ont changé. Rechargez la page.", 409);
    await tx.session.deleteMany({ where: { userId: target.id } });
    await tx.auditEvent.create({ data: { actorId, action: "STAFF_ACCESS_CHANGED", objectId: target.id, detail: JSON.stringify({ before: { role: target.role, active: target.active }, after: { role: value.role, active: value.active }, reason: value.reason }) } });
  });
  return { success: true };
}
