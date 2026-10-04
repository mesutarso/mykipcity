import {z} from "zod";
import {createHash,randomUUID} from "node:crypto";
import {mkdir,writeFile,readFile,unlink} from "node:fs/promises";
import {resolve,join} from "node:path";
import type {Prisma} from "@/generated/prisma/client";
import {db} from "./db";
import {WorkflowError} from "./workflow";
import {detectFile} from "./documents";
import {loanDataSchema,validateLoanFacts,effectiveLoanFacts} from "./loan-model";
const root=()=>resolve(/* turbopackIgnore: true */ process.env.DOCUMENTS_DIR??"./data/documents","loans");
async function access(tx:Prisma.TransactionClient,userId:string,caseId:string){
 const actor=await tx.user.findUnique({where:{id:userId}}),item=await tx.financeCase.findUnique({where:{id:caseId}});
 if(!actor?.active||!item||!(actor.role==="FINANCE_OFFICER"&&item.ownerId===userId||actor.role==="FINANCE_REVIEWER"&&item.reviewerId===userId||actor.role==="FINANCE_VALIDATOR"&&item.validatorId===userId||actor.role==="LEGAL_OFFICER"&&item.legalOfficerId===userId))throw new WorkflowError("Suivi du prêt inaccessible.",404);
 return {actor,item};
}
export async function loanCase(userId:string,id:string){const context=await access(db,userId,id);const loans=await db.loan.findMany({where:{caseId:id},include:{events:{orderBy:{createdAt:"desc"}}},orderBy:{createdAt:"desc"}});return {...context,loans};}
export async function createLoan(userId:string,input:unknown){
 const v=z.object({caseId:z.string().min(1),institutionId:z.string().min(1),reference:z.string().trim().min(2).max(160).transform(s=>s.toLocaleUpperCase("fr")),currency:z.enum(["USD","CDF","EUR"])}).strict().parse(input);
 return db.$transaction(async tx=>{
  const {actor,item}=await access(tx,userId,v.caseId);if(actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Création réservée au référent Finance.",403);
  if(item.status!=="INTERNALLY_VALIDATED")throw new WorkflowError("Terminez la validation interne du dossier avant le suivi du prêteur.",409);
  const institution=await tx.financeInstitution.findFirst({where:{id:v.institutionId,ownerId:userId}});if(!institution)throw new WorkflowError("Institution inaccessible.",404);
  if(await tx.loan.findFirst({where:{caseId:v.caseId,institutionId:v.institutionId,reference:v.reference}}))throw new WorkflowError("Ce suivi existe déjà pour cette institution.",409);
  const loan=await tx.loan.create({data:{...v,institutionName:institution.name}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:"LOAN_CREATED",detail:JSON.stringify({loanId:loan.id,...v})}});return {id:loan.id};
 });
}
export async function depositLoanEvent(userId:string,input:unknown,name:string,bytes:Buffer){
 const v=z.object({loanId:z.string().min(1),version:z.number().int().positive(),replacesId:z.string().min(1).optional(),data:loanDataSchema}).strict().parse(input);
 const initial=await db.loan.findUnique({where:{id:v.loanId}});if(!initial)throw new WorkflowError("Prêt inaccessible.",404);
 const {actor}=await access(db,userId,initial.caseId);if(actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Saisie réservée au référent Finance.",403);
 const mimeType=detectFile(bytes),storageKey=randomUUID(),sha256=createHash("sha256").update(bytes).digest("hex"),path=join(/* turbopackIgnore: true */ root(),storageKey);
 await mkdir(root(),{recursive:true,mode:0o700});await writeFile(path,bytes,{flag:"wx",mode:0o600});
 try{return await db.$transaction(async tx=>{
  const {actor,item}=await access(tx,userId,initial.caseId);if(actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Accès modifié.",403);
  if(item.status!=="INTERNALLY_VALIDATED")throw new WorkflowError("Le dossier doit être validé en interne.",409);
  const loan=await tx.loan.findUniqueOrThrow({where:{id:v.loanId},include:{events:true}});
  const effective=effectiveLoanFacts(loan.events),previous=v.replacesId?loan.events.find(e=>e.id===v.replacesId):null;
  if(v.replacesId&&(!previous||previous.kind!==v.data.kind||previous.status==="PENDING"||previous.status==="ACCEPTED"&&!effective.some(e=>e.id===previous.id)))throw new WorkflowError("Corrigez uniquement la dernière version contrôlée ou refusée du même fait.",409);
  if(effective.some(e=>e.data.kind==="CLOSURE"))throw new WorkflowError("Le prêt est clôturé. Une reprise doit d’abord être autorisée hors de ce registre.",409);
  if(loan.events.some(e=>e.status==="PENDING"))throw new WorkflowError("Faites contrôler le fait en attente avant une nouvelle saisie.",409);
  try{validateLoanFacts([...loan.events,{id:"candidate",status:"ACCEPTED",replacesId:v.replacesId??null,data:v.data}]);}catch(e){throw new WorkflowError((e as Error).message,409);}
  const changed=await tx.loan.updateMany({where:{id:loan.id,version:v.version},data:{version:{increment:1}}});if(!changed.count)throw new WorkflowError("Le suivi a changé. Rechargez la page.",409);
  const event=await tx.loanEvent.create({data:{loanId:loan.id,kind:v.data.kind,data:v.data,replacesId:v.replacesId,authorId:userId,authorName:actor.name,authorPersonId:actor.personId,originalName:name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,160)||"justificatif",storageKey,mimeType,sha256,size:bytes.length}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:"LOAN_FACT_RECORDED",detail:JSON.stringify({loanId:loan.id,eventId:event.id,kind:v.data.kind,replacesId:v.replacesId,sha256})}});return {id:event.id};
 });}catch(e){await unlink(path);throw e;}
}
async function proof(event:{storageKey:string;sha256:string}){
 if(!/^[a-f0-9-]{36}$/.test(event.storageKey))throw new WorkflowError("Justificatif indisponible.",404);
 const bytes=await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ root(),event.storageKey));
 if(createHash("sha256").update(bytes).digest("hex")!==event.sha256)throw new WorkflowError("Le justificatif a été altéré.",409);return bytes;
}
export async function reviewLoanEvent(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().positive(),decision:z.enum(["ACCEPTED","REJECTED"]),sourceChecked:z.literal(true),reason:z.string().trim().min(10).max(2000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const event=await tx.loanEvent.findUnique({where:{id:v.id},include:{loan:{include:{events:true}}}});if(!event)throw new WorkflowError("Fait inaccessible.",404);
  const {actor,item}=await access(tx,userId,event.loan.caseId);
  if(actor.role!=="FINANCE_REVIEWER"||actor.personId===event.authorPersonId)throw new WorkflowError("Le contrôle exige le contrôleur affecté, distinct du préparateur.",403);
  if(event.status!=="PENDING"||item.status!=="INTERNALLY_VALIDATED")throw new WorkflowError("Fait déjà contrôlé ou dossier rouvert.",409);
  if(v.decision==="ACCEPTED"){
   await proof(event);
   try{validateLoanFacts(event.loan.events.map(e=>e.id===event.id?{...e,status:"ACCEPTED"}:e));}catch(e){throw new WorkflowError((e as Error).message,409);}
  }
  const changed=await tx.loan.updateMany({where:{id:event.loanId,version:v.version},data:{version:{increment:1}}});if(!changed.count)throw new WorkflowError("Le suivi a changé. Rechargez la page.",409);
  await tx.loanEvent.update({where:{id:event.id},data:{status:v.decision,reviewerId:userId,reviewerName:actor.name,reviewerPersonId:actor.personId,reviewedAt:new Date(),reviewReason:v.reason}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:`LOAN_FACT_${v.decision}`,detail:JSON.stringify({eventId:event.id,loanId:event.loanId,reason:v.reason,sourceChecked:true,sha256:event.sha256})}});return {success:true};
 });
}
export async function readLoanProof(userId:string,id:string){
 const event=await db.loanEvent.findUnique({where:{id},include:{loan:true}});if(!event)throw new WorkflowError("Justificatif inaccessible.",404);
 await access(db,userId,event.loan.caseId);const bytes=await proof(event);
 await db.auditEvent.create({data:{actorId:userId,objectId:event.loan.caseId,action:"LOAN_PROOF_DOWNLOADED",detail:event.id}});return {document:event,bytes};
}
