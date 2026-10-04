import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { requireAdmin } from "./team";
import { WorkflowError } from "./workflow";
const command = z.object({
  kind: z.enum(["case", "institution"]), id: z.string().min(1),
  ownerId: z.string().min(1), version: z.number().int().positive(),
  targetId: z.string().min(1), reason: z.string().trim().min(5, "Précisez le motif (5 caractères minimum).").max(500),
}).strict();
export async function reassignFinance(actorId: string, input: unknown) {
  const v = command.parse(input);
  try {
    return await db.$transaction(async tx => {
      await requireAdmin(tx, actorId);
      if (v.ownerId === v.targetId) throw new WorkflowError("Choisissez un autre référent.");
      const target = await tx.user.findUnique({ where: { id: v.targetId } });
      if (!target?.active || target.role !== "FINANCE_OFFICER") throw new WorkflowError("Le nouveau référent doit disposer d’un accès Finance actif.", 409);
      const previous = await tx.user.findUnique({ where: { id: v.ownerId } });
      if (!previous) throw new WorkflowError("Référent introuvable.", 404);
      let label: string;
      if (v.kind === "case") {
        const item = await tx.financeCase.findUnique({ where: { id: v.id }, select: { reference: true } });
        if (!item) throw new WorkflowError("Dossier introuvable.", 404);
        label = item.reference;
        const changed = await tx.financeCase.updateMany({ where: { id: v.id, ownerId: v.ownerId, version: v.version, status: "DRAFT" }, data: { ownerId: v.targetId, version: { increment: 1 } } });
        if (changed.count !== 1) throw new WorkflowError("Le dossier a changé ou son contrôle est en cours. Retirez-le du circuit avant de le réattribuer.", 409);
      } else {
        const item = await tx.financeInstitution.findUnique({ where: { id: v.id }, select: { name: true, branch: true, identityKey: true } });
        if (!item) throw new WorkflowError("Institution introuvable.", 404);
        label = [item.name, item.branch].filter(Boolean).join(" · ");
        if (await tx.financeInstitution.findUnique({ where: { ownerId_identityKey: { ownerId: v.targetId, identityKey: item.identityKey } } })) throw new WorkflowError("Cette institution et cette agence existent déjà chez le nouveau référent. Le transfert nécessite une résolution du doublon.", 409);
        const changed = await tx.financeInstitution.updateMany({ where: { id: v.id, ownerId: v.ownerId, version: v.version }, data: { ownerId: v.targetId, version: { increment: 1 } } });
        if (changed.count !== 1) throw new WorkflowError("L’affectation ou la fiche a changé. Rechargez la page.", 409);
      }
      await tx.auditEvent.create({ data: { actorId, objectId: v.id, action: v.kind === "case" ? "FINANCE_CASE_REASSIGNED" : "FINANCE_INSTITUTION_REASSIGNED", detail: JSON.stringify({ label, previousId: previous.id, previousName: previous.name, targetId: target.id, targetName: target.name, reason: v.reason }) } });
      return { success: true };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new WorkflowError("Une fiche identique existe déjà chez le nouveau référent.", 409);
    throw error;
  }
}

export async function replaceValidator(actorId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().positive(),targetId:z.string().min(1),reason:z.string().trim().min(10,"Précisez le motif (10 caractères minimum).").max(1000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  await requireAdmin(tx,actorId);
  const item=await tx.financeCase.findUnique({where:{id:v.id}});
  if(!item||item.version!==v.version||!(item.status==="IN_VALIDATION"||item.status==="INTERNALLY_VALIDATED"&&item.reopeningRequestId))throw new WorkflowError("Aucune décision en attente sur cette version du dossier.",409);
  if(item.validatorId===v.targetId)throw new WorkflowError("Choisissez un autre validateur.");
  const target=await tx.user.findUnique({where:{id:v.targetId}});
  if(!target?.active||target.role!=="FINANCE_VALIDATOR")throw new WorkflowError("Choisissez un validateur Finance actif.",409);
  const cycle=await tx.financeReview.findUniqueOrThrow({where:{caseId_cycle:{caseId:item.id,cycle:item.reviewCycle}}});
  const people=await tx.user.findMany({where:{id:{in:[actorId,item.ownerId,...(item.reviewerId?[item.reviewerId]:[])]}},select:{personId:true}});
  const events=await tx.financeReviewEvent.findMany({where:{caseId:item.id,cycle:item.reviewCycle,action:{in:["CONTROL","REQUEST_REOPEN"]}},select:{actorPersonId:true}});
  const excluded=new Set([...(cycle.preparerPeople as string[]),...people.map(p=>p.personId),...events.map(e=>e.actorPersonId)]);
  if(excluded.has(target.personId))throw new WorkflowError("Le validateur doit être distinct de l’administrateur, des préparateurs, du contrôleur et du demandeur de réouverture.",403);
  const previous=item.validatorId?await tx.user.findUnique({where:{id:item.validatorId},select:{name:true}}):null;
  const actor=await tx.user.findUniqueOrThrow({where:{id:actorId}});
  const changed=await tx.financeCase.updateMany({where:{id:item.id,version:v.version,status:item.status,validatorId:item.validatorId,reopeningRequestId:item.reopeningRequestId},data:{validatorId:target.id,version:{increment:1}}});
  if(changed.count!==1)throw new WorkflowError("L’affectation a changé. Rechargez la page.",409);
  await tx.financeReviewEvent.create({data:{caseId:item.id,cycle:item.reviewCycle,actorId,actorName:actor.name,actorPersonId:actor.personId,action:"REPLACE_VALIDATOR",reason:`${previous?.name??"Non attribué"} → ${target.name}. ${v.reason}`}});
  await tx.auditEvent.create({data:{actorId,objectId:item.id,action:"FINANCE_VALIDATOR_REASSIGNED",detail:JSON.stringify({label:item.reference,previousId:item.validatorId,previousName:previous?.name??"Non attribué",targetId:target.id,targetName:target.name,reason:v.reason,cycle:item.reviewCycle,version:v.version+1})}});
  return {success:true};
 });
}

export async function replaceReviewer(actorId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().positive(),targetId:z.string().min(1),reason:z.string().trim().min(10,"Précisez le motif (10 caractères minimum).").max(1000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  await requireAdmin(tx,actorId);
  const item=await tx.financeCase.findUnique({where:{id:v.id}});
  if(!item||item.version!==v.version||item.status!=="IN_REVIEW")throw new WorkflowError("Aucune décision en attente sur cette version du dossier.",409);
  if(item.reviewerId===v.targetId)throw new WorkflowError("Choisissez un autre contrôleur.");
  const target=await tx.user.findUnique({where:{id:v.targetId}});
  if(!target?.active||target.role!=="FINANCE_REVIEWER")throw new WorkflowError("Choisissez un contrôleur Finance actif.",409);
  const cycle=await tx.financeReview.findUniqueOrThrow({where:{caseId_cycle:{caseId:item.id,cycle:item.reviewCycle}}});
  const people=await tx.user.findMany({where:{id:{in:[actorId,item.ownerId,...(item.validatorId?[item.validatorId]:[])]}},select:{personId:true}});
  const events=await tx.financeReviewEvent.findMany({where:{caseId:item.id,cycle:item.reviewCycle,action:{in:["CONTROL","REQUEST_REOPEN"]}},select:{actorPersonId:true}});
  const excluded=new Set([...(cycle.preparerPeople as string[]),...people.map(p=>p.personId),...events.map(e=>e.actorPersonId)]);
  if(excluded.has(target.personId))throw new WorkflowError("Le contrôleur doit être distinct de l’administrateur, des préparateurs, du validateur et du demandeur de réouverture.",403);
  const previous=item.reviewerId?await tx.user.findUnique({where:{id:item.reviewerId},select:{name:true}}):null;
  const actor=await tx.user.findUniqueOrThrow({where:{id:actorId}});
  const changed=await tx.financeCase.updateMany({where:{id:item.id,version:v.version,status:item.status,reviewerId:item.reviewerId,reopeningRequestId:item.reopeningRequestId},data:{reviewerId:target.id,version:{increment:1}}});
  if(changed.count!==1)throw new WorkflowError("L’affectation a changé. Rechargez la page.",409);
  await tx.financeReviewEvent.create({data:{caseId:item.id,cycle:item.reviewCycle,actorId,actorName:actor.name,actorPersonId:actor.personId,action:"REPLACE_REVIEWER",reason:`${previous?.name??"Non attribué"} → ${target.name}. ${v.reason}`}});
  await tx.auditEvent.create({data:{actorId,objectId:item.id,action:"FINANCE_REVIEWER_REASSIGNED",detail:JSON.stringify({label:item.reference,previousId:item.reviewerId,previousName:previous?.name??"Non attribué",targetId:target.id,targetName:target.name,reason:v.reason,cycle:item.reviewCycle,version:v.version+1})}});
  return {success:true};
 });
}
