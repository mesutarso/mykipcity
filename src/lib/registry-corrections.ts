import {identityDetails,readIdentity} from "./dossier-model";
import {z} from "zod";
import {db} from "./db";
import {WorkflowError} from "./workflow";
import type {Prisma} from "@/generated/prisma/client";
async function staff(tx:Prisma.TransactionClient,id:string){const actor=await tx.user.findUnique({where:{id}});if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Accès réservé à l’équipe acquéreurs.",403);return actor;}
const base={id:z.string().min(1),version:z.number().int().nonnegative(),reason:z.string().trim().min(10).max(1000)};
export async function correctRegistry(userId:string,input:unknown){
 const v=z.discriminatedUnion("kind",[z.object({...base,kind:z.literal("acquirer"),name:z.string().trim().min(2).max(120)}).strict(),z.object({...base,kind:z.literal("parcel"),area:z.number().int().positive().max(100000000),cadastralReference:z.string().trim().min(2).max(120)}).strict()]).parse(input);
 return db.$transaction(async tx=>{const actor=await staff(tx,userId);let before,after;
  if(v.kind==="acquirer"){
   const item=await tx.acquirer.findUnique({where:{id:v.id}});if(!item||item.mergedIntoId)throw new WorkflowError("Fiche inaccessible.",404);before={name:item.registeredName};after={name:v.name};
   const changed=await tx.acquirer.updateMany({where:{id:v.id,registryVersion:v.version,mergedIntoId:null},data:{registeredName:v.name,registryVersion:{increment:1}}});if(!changed.count)throw new WorkflowError("La fiche a changé.",409);
  }else{
   const item=await tx.parcel.findUnique({where:{id:v.id}});if(!item)throw new WorkflowError("Parcelle introuvable.",404);
   if(await tx.parcel.findFirst({where:{id:{not:v.id},cadastralReference:v.cadastralReference}}))throw new WorkflowError("Cette référence cadastrale appartient déjà à une autre fiche.",409);
   before={area:item.area,cadastralReference:item.cadastralReference};after={area:v.area,cadastralReference:v.cadastralReference};
   const changed=await tx.parcel.updateMany({where:{id:v.id,registryVersion:v.version},data:{...after,registryVersion:{increment:1}}});if(!changed.count)throw new WorkflowError("La parcelle a changé.",409);
  }
  await tx.auditEvent.create({data:{actorId:userId,objectId:v.id,action:"REGISTRY_CORRECTED",detail:JSON.stringify({actorName:actor.name,kind:v.kind,before,after,reason:v.reason,version:v.version+1})}});return {success:true};
 });
}
export async function mergeRegistry(userId:string,input:unknown){
 const v=z.object({...base,targetReference:z.string().trim().min(1).max(60).toUpperCase(),confirmed:z.literal(true)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await staff(tx,userId),source=await tx.acquirer.findUnique({where:{id:v.id},include:{file:true,_count:{select:{financeCases:true}}}}),target=await tx.acquirer.findUnique({where:{reference:v.targetReference}});
  if(!source||!target||source.id===target.id||source.mergedIntoId||target.mergedIntoId)throw new WorkflowError("Choisissez deux fiches distinctes encore actives.",409);
  if(source.userId||source.file||source._count.financeCases)throw new WorkflowError("Ce doublon possède un compte ou un dossier. Sa reprise nécessite un examen individuel des droits et des pièces.",409);
  const changed=await tx.acquirer.updateMany({where:{id:source.id,registryVersion:v.version,mergedIntoId:null,userId:null},data:{mergedIntoId:target.id,registryVersion:{increment:1}}});if(!changed.count)throw new WorkflowError("La fiche a changé.",409);
  await tx.invitation.updateMany({where:{acquirerId:source.id,consumedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:source.id,action:"REGISTRY_MERGED",detail:JSON.stringify({actorName:actor.name,sourceReference:source.reference,targetId:target.id,targetReference:target.reference,reason:v.reason})}});
  return {success:true};
 });
}
export async function correctIdentity(userId:string,input:unknown){
 const v=z.object({...base,fullName:z.string().trim().min(2).max(120),details:identityDetails.optional(),proofId:z.string().min(1),checked:z.literal(true)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await staff(tx,userId),file=await tx.acquirerFile.findUnique({where:{id:v.id}});if(!file)throw new WorkflowError("Dossier introuvable.",404);
  if(v.details&&(v.details.quality!==readIdentity(file.details).quality||v.details.holderName!==readIdentity(file.details).holderName))throw new WorkflowError("Le titulaire et sa qualité se réexaminent dans le parcours des droits par parcelle.",409);
  const proof=await tx.document.findFirst({where:{id:v.proofId,fileId:file.id,isCurrent:true}});if(!proof)throw new WorkflowError("Choisissez une pièce actuelle de ce dossier.",409);
  const changed=await tx.acquirerFile.updateMany({where:{id:file.id,version:v.version},data:{fullName:v.fullName,...(v.details?{details:v.details}:{}),version:{increment:1}}});if(!changed.count)throw new WorkflowError("Le dossier a changé.",409);
  await tx.auditEvent.create({data:{actorId:userId,objectId:file.id,action:"IDENTITY_CORRECTED",detail:JSON.stringify({actorName:actor.name,before:file.fullName,after:v.fullName,beforeDetails:file.details,afterDetails:v.details??file.details,reason:v.reason,proofId:proof.id,sha256:proof.sha256})}});return {success:true};
 });
}
