import {activeParcelWhere} from "@/lib/parcel-access-model";
import { z } from "zod";
import { db } from "./db";
import { getActor,WorkflowError } from "./workflow";
import { memberUpdateSchema } from "./member-finance-model";
export async function manageMemberUpdate(userId:string,input:unknown){
 const v=z.discriminatedUnion("action",[
  z.object({action:z.literal("save"),caseId:z.string().min(1),version:z.number().int().nonnegative(),data:memberUpdateSchema}).strict(),
  z.object({action:z.enum(["publish","withdraw"]),caseId:z.string().min(1),version:z.number().int().positive()}).strict(),
 ]).parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Accès réservé au référent Finance.",403);
  const item=await tx.financeCase.findFirst({where:{id:v.caseId,ownerId:userId},select:{id:true,acquirerId:true}});if(!item)throw new WorkflowError("Dossier inaccessible.",404);
  const current=await tx.financeMemberUpdate.findUnique({where:{caseId:item.id}});
  if((current?.version??0)!==v.version)throw new WorkflowError("Le suivi a changé. Rechargez la page.",409);
  if(v.action==="save"){
   if(current)await tx.financeMemberUpdate.update({where:{id:current.id},data:{draft:v.data,version:{increment:1}}});
   else await tx.financeMemberUpdate.create({data:{caseId:item.id,draft:v.data}});
  }else{
   if(!current)throw new WorkflowError("Enregistrez d’abord le suivi.");
   if(v.action==="publish"){
    const acquirer=item.acquirerId?await tx.acquirer.findFirst({where:{id:item.acquirerId,user:{active:true,role:"ACQUIRER"},file:{declarations:{some:activeParcelWhere()}}},select:{id:true}}):null;
    if(!acquirer)throw new WorkflowError("Le dossier doit être lié à un acquéreur actif dont une parcelle est validée.",409);
    const data=memberUpdateSchema.parse(current.draft);
    await tx.financeMemberUpdate.update({where:{id:current.id},data:{published:data,audienceId:acquirer.id,visible:true,publishedAt:new Date(),version:{increment:1}}});
   }else{
    if(!current.visible)throw new WorkflowError("Ce suivi n’est pas publié.",409);
    await tx.financeMemberUpdate.update({where:{id:current.id},data:{visible:false,version:{increment:1}}});
   }
  }
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:`MEMBER_FINANCE_${v.action.toUpperCase()}`,detail:JSON.stringify({version:v.version+1,...(v.action==="save"?{content:v.data}:v.action==="publish"?{content:current!.draft,audienceId:item.acquirerId}:{})})}});
  return {success:true};
 });
}
export async function memberFinance(userId:string){
 const actor=await getActor(userId);if(actor.role!=="ACQUIRER")throw new WorkflowError("Accès réservé à l’acquéreur.",403);
 const acquirers=await db.acquirer.findMany({where:{userId,file:{declarations:{some:activeParcelWhere()}}},select:{id:true}});
 if(!acquirers.length)return [];
 const rows=await db.financeMemberUpdate.findMany({where:{visible:true,OR:acquirers.map(a=>({audienceId:a.id,case:{acquirerId:a.id}}))},select:{id:true,published:true,publishedAt:true},orderBy:{publishedAt:"desc"}});
 return rows.map(row=>({id:row.id,publishedAt:row.publishedAt,content:memberUpdateSchema.parse(row.published)}));
}
