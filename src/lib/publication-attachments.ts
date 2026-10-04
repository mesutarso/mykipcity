import { createHash,randomUUID } from "node:crypto";
import { mkdir,writeFile,readFile,unlink } from "node:fs/promises";
import { resolve,join,relative,sep } from "node:path";
import { z } from "zod";
import { db } from "./db";
import { getActor,WorkflowError,requireStaff } from "./workflow";
import { detectFile } from "./documents";
import { memberPublication,staffPublication } from "./publications";
export const attachmentSelect={id:true,caption:true,takenOn:true,mimeType:true,originalName:true,size:true} as const;
export type AttachmentView={id:string;caption:string;takenOn:string;mimeType:string;originalName:string;size:number};
function directory(id:string){
 if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new WorkflowError("Publication inaccessible.",404);
 const root=resolve(/* turbopackIgnore: true */ process.env.DOCUMENTS_DIR??"./data/documents");const inside=relative(resolve("public"),root);
 if(!inside||(!inside.startsWith(`..${sep}`)&&inside!==".."))throw new Error("Le stockage doit rester hors du dossier public");
 return join(/* turbopackIgnore: true */ root,"publications",id);
}
const uploadSchema=z.object({publicationId:z.string().min(1),version:z.number().int().positive(),caption:z.string().trim().min(3,"Décrivez le fichier.").max(300),takenOn:z.union([z.literal(""),z.iso.date()])}).strict();
export async function uploadPublicationAttachment(userId:string,input:unknown,name:string,bytes:Buffer){
 const v=uploadSchema.parse(input);const actor=await getActor(userId);const item=await staffPublication(userId,v.publicationId);
 if(item.authorId!==actor.id||item.status!=="DRAFT")throw new WorkflowError("Seul l’auteur peut joindre un fichier à son brouillon.",403);
 const mimeType=detectFile(bytes);
 if(mimeType==="application/pdf"&&v.takenOn)throw new WorkflowError("La date de prise de vue concerne uniquement les photos.");
 if(v.takenOn&&v.takenOn>new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Kinshasa"}))throw new WorkflowError("La date de prise de vue ne peut pas être future.");
 const storageKey=randomUUID(),root=directory(item.id),path=join(/* turbopackIgnore: true */ root,storageKey);
 await mkdir(root,{recursive:true,mode:0o700});await writeFile(path,bytes,{flag:"wx",mode:0o600});
 try{return await db.$transaction(async tx=>{
  const fresh=await tx.user.findUnique({where:{id:userId}});if(!fresh?.active||fresh.role!=="ACQUIRER_AGENT")throw new WorkflowError("Accès indisponible.",403);
  if(await tx.publicationAttachment.count({where:{publicationId:item.id,removedAt:null}})>=12)throw new WorkflowError("Une publication peut contenir 12 fichiers maximum.");
  const changed=await tx.memberPublication.updateMany({where:{id:item.id,authorId:userId,status:"DRAFT",version:v.version},data:{version:{increment:1}}});if(changed.count!==1)throw new WorkflowError("La publication a changé. Rechargez la page.",409);
  const file=await tx.publicationAttachment.create({data:{publicationId:item.id,caption:v.caption,takenOn:v.takenOn,mimeType,storageKey,originalName:name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,160)||"document",size:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:"PUBLICATION_ATTACHMENT_ADDED",detail:JSON.stringify({actorName:actor.name,version:v.version+1,attachmentId:file.id,caption:file.caption,takenOn:file.takenOn,sha256:file.sha256})}});
  return {id:file.id};
 });}catch(e){await unlink(path);throw e;}
}
export async function removePublicationAttachment(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().positive(),reason:z.string().trim().min(3).max(1000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Accès réservé à l’équipe acquéreurs.",403);
  const file=await tx.publicationAttachment.findFirst({where:{id:v.id,removedAt:null}});if(!file)throw new WorkflowError("Fichier inaccessible.",404);
  const changed=await tx.memberPublication.updateMany({where:{id:file.publicationId,authorId:userId,status:"DRAFT",version:v.version},data:{version:{increment:1}}});if(changed.count!==1)throw new WorkflowError("Seul l’auteur peut modifier son brouillon à jour.",409);
  await tx.publicationAttachment.update({where:{id:file.id},data:{removedAt:new Date()}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:file.publicationId,action:"PUBLICATION_ATTACHMENT_REMOVED",detail:JSON.stringify({actorName:actor.name,version:v.version+1,attachmentId:file.id,reason:v.reason})}});
  return {success:true};
 });
}
export async function publicationAttachments(userId:string,publicationId:string){
 const actor=await getActor(userId);
 if(actor.role==="ACQUIRER_AGENT")await staffPublication(userId,publicationId);else await memberPublication(userId,publicationId);
 return db.publicationAttachment.findMany({where:{publicationId,removedAt:null},select:attachmentSelect,orderBy:{createdAt:"asc"}});
}
export async function readPublicationAttachment(userId:string,id:string,archive=false){
 if(archive)await requireStaff(userId);
 const file=await db.publicationAttachment.findFirst({where:{id,...(archive?{}:{removedAt:null})}});if(!file)throw new WorkflowError("Fichier inaccessible.",404);
 const actor=await getActor(userId);if(actor.role==="ACQUIRER_AGENT")await staffPublication(userId,file.publicationId);else await memberPublication(userId,file.publicationId);
 if(!/^[a-f0-9-]{36}$/.test(file.storageKey))throw new WorkflowError("Fichier indisponible.",404);
 const bytes=await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ directory(file.publicationId),file.storageKey));
 if(createHash("sha256").update(bytes).digest("hex")!==file.sha256)throw new WorkflowError("L’intégrité du fichier doit être vérifiée.",409);
 return {file,bytes};
}
