import {activeParcelWhere} from "@/lib/parcel-access-model";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { getActor,WorkflowError } from "./workflow";

// Recheck the invitation audience as well as the currently published follow-up.
// Assigning a case to another buyer never transfers the previous buyer's files.
export async function memberRequirement(tx:Prisma.TransactionClient,userId:string,requirementId:string){
 const actor=await tx.user.findUnique({where:{id:userId}});
 if(!actor?.active||actor.role!=="ACQUIRER")throw new WorkflowError("Pièce inaccessible.",404);
 const req=await tx.financeRequirement.findUnique({
  where:{id:requirementId},
  include:{
   case:{include:{memberUpdate:true,acquirer:{include:{file:{select:{declarations:{where:activeParcelWhere(),select:{id:true}}}}}}}},
   documents:{orderBy:{revision:"desc"},take:1},
  },
 });
 const item=req?.case;
 if(!req?.sharedAt||!req.memberAudienceId||!item?.acquirer||item.acquirer.userId!==userId||!item.acquirer.file?.declarations.length||req.memberAudienceId!==item.acquirerId||!item.memberUpdate?.visible||item.memberUpdate.audienceId!==req.memberAudienceId)throw new WorkflowError("Pièce inaccessible.",404);
 return req;
}
export async function shareFinanceRequirement(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().nonnegative(),share:z.boolean(),instructions:z.string().trim().max(1500).default("")}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Accès réservé au référent Finance.",403);
  const req=await tx.financeRequirement.findFirst({where:{id:v.id,case:{ownerId:userId}},include:{case:{include:{acquirer:{include:{user:true,file:{include:{declarations:{where:activeParcelWhere()}}}}},memberUpdate:true}},documents:{orderBy:{revision:"desc"},take:1}}});
  if(!req)throw new WorkflowError("Pièce inaccessible.",404);
  if(req.sharingVersion!==v.version)throw new WorkflowError("Le partage a changé. Rechargez la page.",409);
  const item=req.case;
  if(v.share){
   if(item.status!=="DRAFT")throw new WorkflowError("Le dossier est verrouillé.",409);
   if(!item.acquirer?.user?.active||item.acquirer.user.role!=="ACQUIRER"||!item.acquirer.file?.declarations.length||!item.memberUpdate?.visible||item.memberUpdate.audienceId!==item.acquirerId)throw new WorkflowError("Publiez d’abord le suivi pour un acquéreur actif avec une parcelle validée.",409);
   if(req.documents[0]&&req.documents[0].status!=="REJECTED")throw new WorkflowError("Une pièce est déjà reçue ou contrôlée. Examinez-la avant de demander un remplacement.",409);
  }
  await tx.financeRequirement.update({where:{id:req.id,sharingVersion:v.version},data:{sharingVersion:{increment:1},memberAudienceId:v.share?item.acquirerId:null,sharedAt:v.share?new Date():null,memberInstructions:v.share?v.instructions:""}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:v.share?"FINANCE_REQUIREMENT_SHARED":"FINANCE_REQUIREMENT_WITHDRAWN",detail:JSON.stringify({requirementId:req.id,audienceId:v.share?item.acquirerId:null,instructions:v.instructions,version:v.version+1})}});
  return {success:true};
 });
}
export async function memberFinanceRequirements(userId:string){
 const actor=await getActor(userId);if(actor.role!=="ACQUIRER")throw new WorkflowError("Accès réservé aux acquéreurs.",403);
 const rows=await db.financeRequirement.findMany({where:{sharedAt:{not:null},case:{acquirer:{userId}}},select:{id:true},orderBy:{createdAt:"desc"}});
 const result=[];
 for(const row of rows){
  let req;try{req=await memberRequirement(db,userId,row.id);}catch(e){if(e instanceof WorkflowError&&e.status===404)continue;throw e;}
  const aliases=await db.user.findMany({where:{OR:[{id:userId},{mergedIntoUserId:userId}]},select:{id:true}});
  const docs=await db.financeDocument.findMany({where:{requirementId:req.id,uploadedBy:{in:aliases.map(u=>u.id)}},select:{id:true,revision:true,originalName:true,status:true,reason:true,createdAt:true},orderBy:{revision:"desc"}});
  const latest=req.documents[0];
  result.push({id:req.id,label:req.label,instructions:req.memberInstructions,version:req.version,title: (req.case.memberUpdate!.published as {title:string}).title,canUpload:req.case.status==="DRAFT"&&(!latest||latest.status==="REJECTED"),documents:docs});
 }
 return result;
}
