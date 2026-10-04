import { z } from "zod";
import { db } from "./db";
import { WorkflowError } from "./workflow";
import type { Prisma } from "@/generated/prisma/client";
export const reopeningActions={REQUEST_REOPEN:"Réouverture demandée",APPROVE_REOPEN:"Réouverture autorisée",REJECT_REOPEN:"Réouverture refusée",CANCEL_REOPEN:"Demande de réouverture annulée"};
export async function changeReopening(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().positive(),action:z.enum(["REQUEST_REOPEN","APPROVE_REOPEN","REJECT_REOPEN","CANCEL_REOPEN"]),reason:z.string().trim().min(10,"Précisez le motif (10 caractères minimum).").max(2000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active)throw new WorkflowError("Compte indisponible.",403);
  const item=await tx.financeCase.findUnique({where:{id:v.id}});
  const owner=actor.role==="FINANCE_OFFICER"&&item?.ownerId===actor.id;
  const validator=actor.role==="FINANCE_VALIDATOR"&&item?.validatorId===actor.id;
  const ownerAction=v.action==="REQUEST_REOPEN"||v.action==="CANCEL_REOPEN";
  if(!item||(ownerAction?!owner:!validator))throw new WorkflowError("Cette action ne vous est pas attribuée.",403);
  if(item.status!=="INTERNALLY_VALIDATED"||item.version!==v.version)throw new WorkflowError("Le dossier a changé ou n’est plus validé. Rechargez la page.",409);
  const pending=item.reopeningRequestId?await tx.financeReviewEvent.findFirst({where:{id:item.reopeningRequestId,caseId:item.id,cycle:item.reviewCycle,action:"REQUEST_REOPEN"}}):null;
  if(v.action==="REQUEST_REOPEN"?!!item.reopeningRequestId:!pending)throw new WorkflowError("La demande de réouverture a changé. Rechargez la page.",409);
  if(!ownerAction){
   const review=await tx.financeReview.findUniqueOrThrow({where:{caseId_cycle:{caseId:item.id,cycle:item.reviewCycle}}});
   const preparers=review.preparerPeople as string[];
   const responsible=await tx.user.findUniqueOrThrow({where:{id:item.ownerId}});
   if(preparers.includes(actor.personId)||responsible.personId===actor.personId||pending?.actorPersonId===actor.personId)throw new WorkflowError("La décision doit être prise par une personne distincte de la préparation et de la demande.",403);
  }
  const event=await tx.financeReviewEvent.create({data:{caseId:item.id,cycle:item.reviewCycle,actorId:actor.id,actorName:actor.name,actorPersonId:actor.personId,action:v.action,reason:v.reason}});
  const reopen=v.action==="APPROVE_REOPEN";
  const updated=await tx.financeCase.updateMany({where:{id:item.id,version:v.version,status:"INTERNALLY_VALIDATED",reopeningRequestId:item.reopeningRequestId},data:{version:{increment:1},reopeningRequestId:v.action==="REQUEST_REOPEN"?event.id:null,...(reopen?{status:"DRAFT"}:{})}});
  if(updated.count!==1)throw new WorkflowError("Une décision vient d’être enregistrée. Rechargez la page.",409);
  if(reopen){
   // Withdraw only unsigned preparations; preserve every payload and historical revision.
   const authorizations=await tx.financeAuthorization.findMany({where:{caseId:item.id,status:{in:["DRAFT","READY_FOR_SIGNATURE"]}}});
   for(const a of authorizations){
    await tx.financeAuthorization.update({where:{id:a.id},data:{status:"WITHDRAWN",version:{increment:1}}});
    await tx.financeAuthorizationRevision.create({data:{authorizationId:a.id,version:a.version+1,status:"WITHDRAWN",payload:a.payload as Prisma.InputJsonValue,actorId:actor.id,reason:`Dossier rouvert pour correction : ${v.reason}`}});
   }
  }
  await tx.auditEvent.create({data:{actorId:actor.id,objectId:item.id,action:`FINANCE_${v.action}`,detail:JSON.stringify({cycle:item.reviewCycle,requestId:pending?.id??event.id,eventId:event.id,reason:v.reason,version:v.version+1})}});
  return {success:true,reopened:reopen};
 });
}
