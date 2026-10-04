import { createHash,randomUUID } from "node:crypto";
import { mkdir,writeFile,readFile,unlink } from "node:fs/promises";
import { resolve,join,relative,sep } from "node:path";
import { z } from "zod";
import { db } from "./db";
import { getActor,WorkflowError } from "./workflow";
import { detectFile } from "./documents";
import { memberDocumentSchema } from "./member-document-model";
function storageDirectory(fileId:string,documentId:string){
 if(!/^[a-zA-Z0-9_-]+$/.test(fileId)||!/^[a-zA-Z0-9_-]+$/.test(documentId))throw new WorkflowError("Document indisponible.",404);
 const root=resolve(/* turbopackIgnore: true */ process.env.DOCUMENTS_DIR??"./data/documents");
 const fromPublic=relative(resolve("public"),root);
 if(!fromPublic||(!fromPublic.startsWith(`..${sep}`)&&fromPublic!==".."))throw new Error("DOCUMENTS_DIR doit rester hors du dossier public");
 return join(/* turbopackIgnore: true */ root,"mykipcity",fileId,documentId);
}
export async function memberDocumentFile(userId:string,fileId:string){
 const actor=await getActor(userId);
 if(!["ACQUIRER_AGENT","ACQUIRER"].includes(actor.role))throw new WorkflowError("Dossier inaccessible.",404);
 const file=await db.acquirerFile.findFirst({where:{id:fileId,...(actor.role==="ACQUIRER"?{acquirer:{userId}}:{})},include:{acquirer:true,declarations:true}});
 if(!file)throw new WorkflowError("Dossier inaccessible.",404);
 return {actor,file};
}
export async function createMemberDocument(userId:string,input:unknown){
 const v=memberDocumentSchema.parse(input);await memberDocumentFile(userId,v.fileId);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Action réservée à l’équipe acquéreurs.",403);
  const parcels=await tx.parcelDeclaration.findMany({where:{fileId:v.fileId},select:{reference:true}});
  const references=[...new Set(v.parcelReferences)];if(references.some(ref=>!parcels.some(p=>p.reference===ref)))throw new WorkflowError("Une parcelle ne fait pas partie de ce dossier.");
  const item=await tx.memberDocument.create({data:{...v,parcelReferences:references}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:v.fileId,action:"MEMBER_DOCUMENT_CREATED",detail:JSON.stringify({id:item.id,title:v.title,direction:v.direction,parcelReferences:references})}});
  return {id:item.id};
 });
}
export async function uploadMemberDocument(userId:string,input:unknown,name:string,bytes:Buffer){
 const v=z.object({documentId:z.string().min(1),version:z.number().int().nonnegative()}).strict().parse(input);
 const item=await db.memberDocument.findUnique({where:{id:v.documentId}});if(!item)throw new WorkflowError("Document inaccessible.",404);
 const {actor}=await memberDocumentFile(userId,item.fileId);
 if((item.direction==="REQUESTED"&&actor.role!=="ACQUIRER")||(item.direction==="RECEIVED"&&actor.role!=="ACQUIRER_AGENT"))throw new WorkflowError("Ce dépôt est réservé à son destinataire.",403);
 const mimeType=detectFile(bytes),storageKey=randomUUID(),directory=storageDirectory(item.fileId,item.id);
 await mkdir(directory,{recursive:true,mode:0o700});const path=join(/* turbopackIgnore: true */ directory,storageKey);await writeFile(path,bytes,{flag:"wx",mode:0o600});
 try{return await db.$transaction(async tx=>{
  const fresh=await tx.user.findUnique({where:{id:userId}});if(!fresh?.active||fresh.role!==actor.role)throw new WorkflowError("Accès suspendu ou modifié.",403);
  const current=await tx.memberDocument.findFirst({where:{id:item.id,...(actor.role==="ACQUIRER"?{file:{acquirer:{userId}}}:{})},include:{versions:{orderBy:{revision:"desc"},take:1}}});
  if(!current)throw new WorkflowError("Document inaccessible.",404);
  if(current.closedAt)throw new WorkflowError("Cette demande est annulée ou ce document a été retiré.",409);
  if(actor.role==="ACQUIRER"&&current.versions[0]?.status==="ACCEPTED")throw new WorkflowError("Cette pièce est acceptée. Contactez l’équipe pour une correction.",409);
  const changed=await tx.memberDocument.updateMany({where:{id:item.id,version:v.version},data:{version:{increment:1}}});if(changed.count!==1)throw new WorkflowError("Le document a changé. Rechargez avant de déposer.",409);
  const revision=(current.versions[0]?.revision??0)+1;
  const doc=await tx.memberDocumentVersion.create({data:{documentId:item.id,revision,storageKey,mimeType,size:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),originalName:name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,160)||"document",uploadedBy:userId,status:actor.role==="ACQUIRER_AGENT"?"DELIVERED":"PENDING"}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.fileId,action:"MEMBER_DOCUMENT_UPLOADED",detail:JSON.stringify({documentId:item.id,id:doc.id,revision})}});
  return {id:doc.id};
 });}catch(e){await unlink(path);throw e;}
}
export async function reviewMemberDocument(userId:string,input:unknown){
 const v=z.object({documentId:z.string().min(1),version:z.number().int().positive(),decision:z.enum(["ACCEPTED","NEEDS_INFO"]),reason:z.string().trim().min(5,"Précisez le résultat du contrôle.").max(2000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Action réservée à l’équipe acquéreurs.",403);
  const item=await tx.memberDocument.findUnique({where:{id:v.documentId},include:{versions:{orderBy:{revision:"desc"},take:1}}});
  if(!item||item.closedAt||item.direction!=="REQUESTED"||!item.versions[0])throw new WorkflowError("Aucune pièce à examiner.",404);
  const changed=await tx.memberDocument.updateMany({where:{id:item.id,version:v.version},data:{version:{increment:1}}});if(changed.count!==1)throw new WorkflowError("Le document a changé. Rechargez la page.",409);
  await tx.memberDocumentVersion.update({where:{id:item.versions[0].id},data:{status:v.decision,reason:v.reason,reviewedBy:userId,reviewedAt:new Date()}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.fileId,action:"MEMBER_DOCUMENT_REVIEWED",detail:JSON.stringify({...v,revision:item.versions[0].revision})}});
  return {success:true};
 });
}
export async function memberDocumentList(userId:string,fileId:string){
 const {actor,file}=await memberDocumentFile(userId,fileId);
 const items=await db.memberDocument.findMany({where:{fileId,...(actor.role==="ACQUIRER"?{OR:[{direction:"REQUESTED"},{closedAt:null,versions:{some:{}}}]}:{})},include:{versions:{orderBy:{revision:"desc"},select:{id:true,revision:true,originalName:true,size:true,status:true,reason:true,createdAt:true}}},orderBy:{updatedAt:"desc"}});
 return {file,items};
}
export async function readMemberDocument(userId:string,id:string){
 const doc=await db.memberDocumentVersion.findUnique({where:{id},include:{document:true}});if(!doc)throw new WorkflowError("Document inaccessible.",404);
 const {actor}=await memberDocumentFile(userId,doc.document.fileId);
 if(actor.role==="ACQUIRER"&&doc.document.direction==="RECEIVED"&&doc.document.closedAt)throw new WorkflowError("Document retiré de votre espace.",404);
 if(!/^[a-f0-9-]{36}$/.test(doc.storageKey))throw new WorkflowError("Document indisponible.",404);
 const bytes=await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ storageDirectory(doc.document.fileId,doc.documentId),doc.storageKey));
 if(createHash("sha256").update(bytes).digest("hex")!==doc.sha256)throw new WorkflowError("Le fichier doit être vérifié par l’équipe.",409);
 await db.auditEvent.create({data:{actorId:userId,objectId:doc.document.fileId,action:"MEMBER_DOCUMENT_DOWNLOADED",detail:doc.id}});
 return {document:doc,bytes};
}

export async function closeMemberDocument(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().nonnegative(),reason:z.string().trim().min(5).max(2000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Action réservée à l’équipe acquéreurs.",403);
  const item=await tx.memberDocument.findUnique({where:{id:v.id}});if(!item)throw new WorkflowError("Document inaccessible.",404);
  const changed=await tx.memberDocument.updateMany({where:{id:item.id,version:v.version,closedAt:null},data:{closedAt:new Date(),closingReason:v.reason,version:{increment:1}}});if(changed.count!==1)throw new WorkflowError("Le document a changé ou a déjà été retiré.",409);
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.fileId,action:"MEMBER_DOCUMENT_CLOSED",detail:JSON.stringify({id:item.id,direction:item.direction,reason:v.reason,version:v.version+1})}});
  return {success:true};
 });
}
