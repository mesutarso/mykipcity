import {z} from "zod";
import {createHash,randomUUID} from "node:crypto";
import {mkdir,writeFile,readFile,unlink} from "node:fs/promises";
import {join,resolve} from "node:path";
import type {Prisma} from "@/generated/prisma/client";
import {db} from "./db";
import {getActor,WorkflowError} from "./workflow";
import {detectFile} from "./documents";
import {originalData,originalSituation} from "./original-model";
const root=()=>resolve(/* turbopackIgnore: true */ process.env.DOCUMENTS_DIR??"./data/documents","originals");
export function originalAccess(actor:{id:string;role:string}){
 if(actor.role==="LEGAL_OFFICER")return {OR:[{case:{legalOfficerId:actor.id}},{events:{some:{reviewerId:actor.id,status:"PENDING"}}}]};
 if(actor.role==="FINANCE_OFFICER")return {case:{ownerId:actor.id}};
 if(actor.role==="FINANCE_REVIEWER")return {case:{reviewerId:actor.id}};
 if(actor.role==="FINANCE_VALIDATOR")return {case:{validatorId:actor.id}};
 return {id:"__inaccessible__"};
}
async function cabinet(tx:Prisma.TransactionClient,userId:string,caseId:string){const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="LEGAL_OFFICER")throw new WorkflowError("Saisie réservée au Cabinet.",403);const item=await tx.financeCase.findFirst({where:{id:caseId,legalOfficerId:userId}});if(!item)throw new WorkflowError("Dossier non attribué.",404);return {actor,item};}
export async function getOriginal(userId:string,id:string){const actor=await getActor(userId),item=await db.original.findFirst({where:{id,...originalAccess(actor)},include:{case:{select:{id:true,reference:true,applicantName:true,legalOfficerId:true}},events:{orderBy:{sequence:"desc"}}}});if(!item)throw new WorkflowError("Original inaccessible.",404);return {actor,item};}
export async function recordOriginal(userId:string,input:unknown,name:string,bytes:Buffer){
 const v=z.object({caseId:z.string().min(1),id:z.string().min(1).optional(),reference:z.string().trim().min(2).max(100).transform(s=>s.toLocaleUpperCase("fr")),version:z.number().int().nonnegative(),reviewerId:z.string().min(1),replacesId:z.string().min(1).optional(),data:originalData}).strict().parse(input);
 await cabinet(db,userId,v.caseId);
 const mimeType=detectFile(bytes),storageKey=randomUUID(),sha256=createHash("sha256").update(bytes).digest("hex"),path=join(/* turbopackIgnore: true */ root(),storageKey);
 await mkdir(root(),{recursive:true,mode:0o700});await writeFile(path,bytes,{flag:"wx",mode:0o600});
 try{return await db.$transaction(async tx=>{
  const {actor}=await cabinet(tx,userId,v.caseId),reviewer=await tx.user.findUnique({where:{id:v.reviewerId}});
  if(!reviewer?.active||reviewer.role!=="LEGAL_OFFICER"||reviewer.personId===actor.personId)throw new WorkflowError("Choisissez un autre intervenant actif du Cabinet, distinct du préparateur.",403);
  let item=v.id?await tx.original.findFirst({where:{id:v.id,caseId:v.caseId},include:{events:true}}):null;
  if(v.id&&!item)throw new WorkflowError("Original inaccessible.",404);
  if(!item){
   if(v.version!==0||v.data.kind!=="DEPOSIT"||v.replacesId)throw new WorkflowError("Commencez par la remise initiale.",409);
   if(await tx.original.findUnique({where:{reference:v.reference}}))throw new WorkflowError("Cette référence d’inventaire est déjà utilisée. Une pièce ne peut pas être reclassée dans un autre dossier.",409);
   item=await tx.original.create({data:{caseId:v.caseId,reference:v.reference},include:{events:true}});
  }else{
   if(item.reference!==v.reference)throw new WorkflowError("La référence d’inventaire est immuable.",409);
   if(item.events.some(e=>e.status==="PENDING"))throw new WorkflowError("Terminez ou retirez le contrôle en attente.",409);
   const {effective}=originalSituation(item.events),previous=effective.at(-1);
   if(v.replacesId&&(!previous||previous.id!==v.replacesId||previous.data.kind!==v.data.kind))throw new WorkflowError("Seul le dernier fait contrôlé peut être corrigé, avec le même type de mouvement.",409);
   const changed=await tx.original.updateMany({where:{id:item.id,version:v.version},data:{version:{increment:1}}});if(!changed.count)throw new WorkflowError("L’inventaire a changé. Rechargez la page.",409);
  }
  if(v.data.incidentReference&&!await tx.financeIncident.findFirst({where:{reference:v.data.incidentReference,caseId:v.caseId}}))throw new WorkflowError("La référence FIN-F08 ne correspond pas à un incident de ce dossier.",409);
  const sequence=(item.events.reduce((max,e)=>Math.max(max,e.sequence),0))+1;
  try{originalSituation([...item.events,{id:"candidate",sequence,status:"ACCEPTED",replacesId:v.replacesId??null,data:v.data}]);}catch(e){throw new WorkflowError((e as Error).message,409);}
  const event=await tx.originalEvent.create({data:{originalId:item.id,sequence,kind:v.data.kind,replacesId:v.replacesId,data:v.data,authorId:userId,authorName:actor.name,authorPersonId:actor.personId,reviewerId:reviewer.id,originalName:name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,160)||"justificatif",storageKey,mimeType,sha256,size:bytes.length}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:v.caseId,action:"ORIGINAL_RECORDED",detail:JSON.stringify({originalId:item.id,eventId:event.id,kind:event.kind,sha256,replacesId:v.replacesId})}});return {id:item.id};
 });}catch(e){await unlink(path);throw e;}
}
async function proof(event:{storageKey:string;sha256:string}){if(!/^[a-f0-9-]{36}$/.test(event.storageKey))throw new WorkflowError("Justificatif indisponible.",404);const bytes=await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ root(),event.storageKey));if(createHash("sha256").update(bytes).digest("hex")!==event.sha256)throw new WorkflowError("Le justificatif a été altéré.",409);return bytes;}
export async function decideOriginal(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().positive(),action:z.enum(["ACCEPTED","REJECTED","CANCELLED"]),checks:z.boolean(),reason:z.string().trim().min(10).max(2000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}}),event=await tx.originalEvent.findUnique({where:{id:v.id},include:{original:{include:{case:true,events:true}}}});
  if(!actor?.active||actor.role!=="LEGAL_OFFICER"||!event)throw new WorkflowError("Contrôle inaccessible.",404);
  if(v.action==="CANCELLED"){if(event.original.case.legalOfficerId!==userId)throw new WorkflowError("Retrait réservé au Cabinet affecté.",403);}
  else if(event.reviewerId!==userId||actor.personId===event.authorPersonId)throw new WorkflowError("Contrôle réservé à l’intervenant désigné, distinct du préparateur.",403);
  if(event.status!=="PENDING")throw new WorkflowError("Ce fait a déjà été traité.",409);
  if(v.action==="ACCEPTED"){
   if(!v.checks)throw new WorkflowError("Confirmez l’examen des identités, pouvoirs, inventaire, conditions de garde et preuves.");
   await proof(event);
   try{originalSituation(event.original.events.map(e=>e.id===event.id?{...e,status:"ACCEPTED"}:e));}catch(e){throw new WorkflowError((e as Error).message,409);}
  }
  const changed=await tx.original.updateMany({where:{id:event.originalId,version:v.version},data:{version:{increment:1}}});if(!changed.count)throw new WorkflowError("L’inventaire a changé. Rechargez la page.",409);
  await tx.originalEvent.update({where:{id:event.id},data:{status:v.action,reviewerName:actor.name,reviewerPersonId:actor.personId,reviewedAt:new Date(),reviewReason:v.reason}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:event.original.caseId,action:`ORIGINAL_${v.action}`,detail:JSON.stringify({originalId:event.originalId,eventId:event.id,reason:v.reason,checks:v.checks,sha256:event.sha256})}});return {success:true};
 });
}
export async function readOriginalProof(userId:string,id:string){const event=await db.originalEvent.findUnique({where:{id}});if(!event)throw new WorkflowError("Justificatif inaccessible.",404);const {item}=await getOriginal(userId,event.originalId);const bytes=await proof(event);await db.auditEvent.create({data:{actorId:userId,objectId:item.caseId,action:"ORIGINAL_PROOF_DOWNLOADED",detail:id}});return {document:event,bytes};}
