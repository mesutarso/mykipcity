import {activeParcelWhere} from "@/lib/parcel-access-model";
import { opportunitySchema, opportunityDocuments } from "./opportunity-model";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { getActor, WorkflowError } from "./workflow";
import { requestSchema, budgetSchema } from "./finance-model";
export async function requireFinance(userId:string){
  const actor=await getActor(userId);
  if(actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Accès réservé au service Finance.",403);
  return actor;
}
export async function financeCase(userId:string,id:string){
  await requireFinance(userId);
  const item=await db.financeCase.findFirst({where:{id,ownerId:userId},include:{owner:{select:{name:true}},revisions:{select:{id:true,version:true,code:true,createdAt:true,actor:{select:{name:true}}},orderBy:{version:"desc"}}}});
  if(!item)throw new WorkflowError("Dossier financier inaccessible.",404);
  return item;
}
export async function createFinanceCase(userId:string,input:unknown){
  await requireFinance(userId);const value=requestSchema.parse(input);
  return db.$transaction(async tx=>{
    let acquirerId:string|null=null;
    if(value.acquirerReference){
      const acquirer=await tx.acquirer.findUnique({where:{reference:value.acquirerReference.toUpperCase()},include:{file:{include:{declarations:{where:activeParcelWhere()}}}}});
      if(!acquirer||acquirer.mergedIntoId)throw new WorkflowError("La référence acquéreur est introuvable.");
      if(value.quality==="VERIFIED"&&!acquirer.file?.declarations.length)throw new WorkflowError("Aucun rattachement validé pour cet acquéreur.");
      acquirerId=acquirer.id;
    }
    const reference=`FIN-${new Date().getUTCFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`;
    const item=await tx.financeCase.create({data:{reference,acquirerId,ownerId:userId,applicantName:value.applicantName,pathway:value.pathway,request:value}});
    await tx.financeRevision.create({data:{caseId:item.id,version:1,code:"FIN-F01",payload:value,actorId:userId}});
    await tx.auditEvent.create({data:{actorId:userId,action:"FINANCE_DRAFT_CREATED",objectId:item.id}});
    return {id:item.id};
  });
}
const saveSchema=z.object({id:z.string().min(1),version:z.number().int().positive(),code:z.enum(["FIN-F01","FIN-F02","FIN-F07"]),data:z.unknown()}).strict();
export async function saveFinanceForm(userId:string,input:unknown){
  await requireFinance(userId);const command=saveSchema.parse(input);
  const data=command.code==="FIN-F01"?requestSchema.parse(command.data):command.code==="FIN-F07"?opportunitySchema.parse(command.data):budgetSchema.parse(command.data);
  return db.$transaction(async tx=>{
    const actor=await tx.user.findUnique({where:{id:userId}});
    if(!actor?.active||actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Accès réservé au service Finance.",403);
    const item=await tx.financeCase.findFirst({where:{id:command.id,ownerId:userId}});
    if(!item)throw new WorkflowError("Dossier financier inaccessible.",404);
    if(item.status!=="DRAFT")throw new WorkflowError("Cette version ne peut plus être modifiée.",409);
    if(command.code==="FIN-F07"){
      const requirements=await tx.financeRequirement.findMany({where:{caseId:item.id},include:{documents:true}});
      const allowed=new Set(requirements.flatMap(r=>r.documents.filter(d=>d.revision===r.version&&d.status==="ACCEPTED").map(d=>d.id)));
      if(opportunityDocuments(opportunitySchema.parse(data)).some(id=>!allowed.has(id)))throw new WorkflowError("Choisissez des justificatifs contrôlés dans la version actuelle de ce dossier.");
    }
    let acquirerId=item.acquirerId;
    if(command.code==="FIN-F01"){
      const req=requestSchema.parse(data);acquirerId=null;
      if(req.acquirerReference){
        const acquirer=await tx.acquirer.findUnique({where:{reference:req.acquirerReference.toUpperCase()},include:{file:{include:{declarations:{where:activeParcelWhere()}}}}});
        if(!acquirer||acquirer.mergedIntoId)throw new WorkflowError("La référence acquéreur est introuvable.");
        if(req.quality==="VERIFIED"&&!acquirer.file?.declarations.length)throw new WorkflowError("Aucun rattachement validé pour cet acquéreur.");
        acquirerId=acquirer.id;
      }
    }
    const updated=await tx.financeCase.updateMany({where:{id:item.id,ownerId:userId,version:command.version,status:"DRAFT"},data:{version:{increment:1},...(command.code==="FIN-F01"?{request:data,applicantName:requestSchema.parse(data).applicantName,pathway:requestSchema.parse(data).pathway,acquirerId}:command.code==="FIN-F07"?{opportunity:data}:{budget:data})}});
    if(updated.count!==1)throw new WorkflowError("Le dossier a été modifié. Rechargez la page avant d’enregistrer.",409);
    await tx.financeRevision.create({data:{caseId:item.id,version:command.version+1,code:command.code,payload:data,actorId:userId}});
    await tx.auditEvent.create({data:{actorId:userId,action:"FINANCE_DRAFT_SAVED",objectId:item.id,detail:`${command.code} v${command.version+1}`}});
    return {version:command.version+1};
  });
}
