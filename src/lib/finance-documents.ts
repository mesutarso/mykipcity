import {legalCase} from "./legal";
import { createHash,randomUUID } from "node:crypto";
import { mkdir,writeFile,readFile,unlink } from "node:fs/promises";
import { resolve,join } from "node:path";
import { z } from "zod";
import { db } from "./db";
import { requireFinance,financeCase } from "./finance";
import { WorkflowError } from "./workflow";
import { controlledCase } from "./finance-review";
import { getActor } from "./workflow";
import { memberRequirement } from "./member-finance-documents";
import { detectFile } from "./documents";
const root=()=>resolve(/* turbopackIgnore: true */ process.env.DOCUMENTS_DIR??"./data/documents","finance");
export async function addRequirement(userId:string,input:unknown){
 const v=z.object({caseId:z.string().min(1),category:z.enum(["IDENTITY","LAND","PARCEL","QUOTE","INCOME","BANK","OTHER"]),label:z.string().trim().min(2).max(160)}).strict().parse(input);
 await requireFinance(userId);
 return db.$transaction(async tx=>{
  const item=await tx.financeCase.findFirst({where:{id:v.caseId,ownerId:userId,status:"DRAFT"}});if(!item)throw new WorkflowError("Dossier inaccessible ou verrouillé.",404);
  const req=await tx.financeRequirement.create({data:v});
  await tx.auditEvent.create({data:{actorId:userId,objectId:v.caseId,action:"FINANCE_DOCUMENT_REQUESTED",detail:v.label}});return {id:req.id};
 });
}
export async function depositFinanceDocument(userId:string,input:unknown,name:string,bytes:Buffer){
 const actor=await getActor(userId);
 const v=z.object({requirementId:z.string().min(1),version:z.number().int().nonnegative()}).strict().parse(input);
 const req=await db.financeRequirement.findUnique({where:{id:v.requirementId}});if(!req)throw new WorkflowError("Pièce inaccessible.",404);
 const member=actor.role==="ACQUIRER";
 const shared=member?await memberRequirement(db,userId,req.id):null;
 const item=shared?shared.case:await financeCase(userId,req.caseId);if(item.status!=="DRAFT")throw new WorkflowError("Dossier verrouillé.",409);
 const mimeType=detectFile(bytes);const storageKey=randomUUID();const path=join(/* turbopackIgnore: true */ root(),storageKey);
 await mkdir(root(),{recursive:true,mode:0o700});await writeFile(path,bytes,{flag:"wx",mode:0o600});
 try{return await db.$transaction(async tx=>{
  const currentActor=await tx.user.findUnique({where:{id:userId}});
  if(!currentActor?.active||currentActor.role!==actor.role)throw new WorkflowError("Accès indisponible.",403);
  if(member){const current=await memberRequirement(tx,userId,req.id);if(current.case.status!=="DRAFT"||(current.documents[0]&&current.documents[0].status!=="REJECTED"))throw new WorkflowError("Cette pièce est déjà reçue ou le dossier est verrouillé.",409);}
  const changed=await tx.financeRequirement.updateMany({where:{id:req.id,version:v.version,case:{...(member?{acquirer:{userId}}:{ownerId:userId}),status:"DRAFT"}},data:{version:{increment:1}}});
  if(changed.count!==1)throw new WorkflowError("La pièce a changé. Rechargez avant de déposer le fichier.",409);
  const doc=await tx.financeDocument.create({data:{requirementId:req.id,revision:v.version+1,originalName:name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,160)||"document",storageKey,mimeType,size:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),uploadedBy:userId}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:req.caseId,action:"FINANCE_DOCUMENT_DEPOSITED",detail:doc.id}});return {id:doc.id};
 });}catch(error){await unlink(path);throw error;}
}
export async function readFinanceDocument(userId:string,id:string){
 const actor=await getActor(userId);
 const doc=await db.financeDocument.findFirst({where:{id},include:{requirement:true}});if(!doc)throw new WorkflowError("Document inaccessible.",404);
 if(actor.role==="ACQUIRER"){
  await memberRequirement(db,userId,doc.requirementId);
  if(doc.uploadedBy!==userId&&!await db.user.count({where:{id:doc.uploadedBy,mergedIntoUserId:userId}}))throw new WorkflowError("Document inaccessible.",404);
 }else if(actor.role==="LEGAL_OFFICER")await legalCase(userId,doc.requirement.caseId);
 else if(actor.role==="FINANCE_OFFICER")await financeCase(userId,doc.requirement.caseId);
 else {
  const item=await controlledCase(userId,doc.requirement.caseId);
  const cycle=await db.financeReview.findUniqueOrThrow({where:{caseId_cycle:{caseId:item.id,cycle:item.reviewCycle}}});
  const snapshot=cycle.snapshot as {documents:{id:string}[]};
  if(!snapshot.documents.some(d=>d.id===id))throw new WorkflowError("Document inaccessible.",404);
 }
 if(!/^[a-f0-9-]{36}$/.test(doc.storageKey))throw new WorkflowError("Document indisponible.",404);
 const bytes=await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ root(),doc.storageKey));
 if(createHash("sha256").update(bytes).digest("hex")!==doc.sha256)throw new WorkflowError("Le fichier ne correspond plus au document déposé.",409);
 await db.auditEvent.create({data:{actorId:userId,objectId:doc.requirement.caseId,action:"FINANCE_DOCUMENT_DOWNLOADED",detail:doc.id}});
 return {document:doc,bytes};
}
export async function reviewFinanceDocument(userId:string,input:unknown){
 await requireFinance(userId);
 const v=z.object({id:z.string().min(1),decision:z.enum(["ACCEPTED","REJECTED"]),reason:z.string().trim().min(5,"Précisez le résultat du contrôle.").max(1500)}).strict().parse(input);
 await db.$transaction(async tx=>{
  const doc=await tx.financeDocument.findFirst({where:{id:v.id,requirement:{case:{ownerId:userId,status:"DRAFT"}}},include:{requirement:true}});
  if(!doc)throw new WorkflowError("Document inaccessible ou dossier verrouillé.",404);
  if(doc.revision!==doc.requirement.version)throw new WorkflowError("Une version plus récente doit être examinée.",409);
  const changed=await tx.financeDocument.updateMany({where:{id:doc.id,status:"PENDING"},data:{status:v.decision,reason:v.reason,reviewedBy:userId,reviewedAt:new Date()}});
  if(changed.count!==1)throw new WorkflowError("Cette pièce a déjà été examinée.",409);
  await tx.auditEvent.create({data:{actorId:userId,objectId:doc.requirement.caseId,action:`FINANCE_DOCUMENT_${v.decision}`,detail:`${doc.id} : ${v.reason}`}});
 });
}
