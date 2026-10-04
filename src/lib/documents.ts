import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { documentDetails } from "./dossier-model";
import { db } from "./db";
import { WorkflowError, writableFile, accessibleDocument } from "./workflow";
export const MAX_FILE_SIZE = 8 * 1024 * 1024;
export function detectFile(buffer: Buffer, maxSize=MAX_FILE_SIZE) {
  if (!buffer.length || buffer.length > maxSize) throw new WorkflowError(`Le fichier doit peser entre 1 octet et ${maxSize/1024/1024} Mo.`);
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  throw new WorkflowError("Format non reconnu. Utilisez un PDF, JPEG ou PNG.");
}
const storageRoot = () => resolve(/* turbopackIgnore: true */ process.env.DOCUMENTS_DIR ?? "./data/documents");
export async function depositDocument(userId: string, name: string, buffer: Buffer, metadata?:unknown, fileId?:string) {
  const file = await writableFile(userId, fileId);
  if (!["DRAFT", "NEEDS_INFO"].includes(file.status)) throw new WorkflowError("Le dossier n’accepte pas de nouveau dépôt pour le moment.", 409);
  const details=metadata===undefined?undefined:documentDetails.parse(metadata);
  if(details&&details.parcelReferences.some(ref=>!file.declarations.some(p=>p.reference===ref)))throw new WorkflowError("Une parcelle ne fait pas partie du dossier.");
  const mimeType = detectFile(buffer);
  const storageKey = randomUUID();
  await mkdir(storageRoot(), { recursive: true, mode: 0o700 });
  const path = join(/* turbopackIgnore: true */ storageRoot(), storageKey);
  await writeFile(path, buffer, { flag: "wx", mode: 0o600 });
  try {
    return await db.$transaction(async tx => {
      const actor=await tx.user.findUnique({where:{id:userId}});
      if(!actor?.active||actor.role!=="ACQUIRER")throw new WorkflowError("Accès suspendu ou modifié.",403);
      const locked = await tx.acquirerFile.updateMany({ where: { id: file.id, version: file.version, status: { in: ["DRAFT", "NEEDS_INFO"] } }, data: { version: { increment: 1 } } });
      if (locked.count !== 1) throw new WorkflowError("Le dossier a changé. Rechargez puis recommencez le dépôt.", 409);
      const doc = await tx.document.create({ data: { fileId: file.id, ...(details?{details}:{}), originalName: name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 160) || "document", storageKey, mimeType, size: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") } });
      await tx.auditEvent.create({ data: { actorId: userId, action: "DOCUMENT_DEPOSITED", objectId: file.id, detail: doc.id } });
      return doc;
    });
  } catch (error) { await unlink(path); throw error; }
}
export async function readDocument(userId: string, id: string) {
  const document = await accessibleDocument(userId, id);
  if (!/^[a-f0-9-]{36}$/.test(document.storageKey)) throw new WorkflowError("Document indisponible.", 404);
  const bytes = await readFile(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ storageRoot(), document.storageKey));
  if (createHash("sha256").update(bytes).digest("hex") !== document.sha256) throw new WorkflowError("L’intégrité du document doit être vérifiée par l’équipe.", 409);
  await db.auditEvent.create({ data: { actorId: userId, action: "DOCUMENT_DOWNLOADED", objectId: document.fileId, detail: document.id } });
  return { document, bytes };
}
export async function classifyDocument(userId:string,input:unknown){
 const {z}=await import("zod");
 const v=z.object({id:z.string().min(1),version:z.number().int().nonnegative(),details:documentDetails}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});
  const doc=await tx.document.findUnique({where:{id:v.id},include:{file:{include:{acquirer:true,declarations:true}}}});
  if(!actor?.active||!doc||actor.role!=="ACQUIRER"||doc.file.acquirer.userId!==userId)throw new WorkflowError("Document inaccessible.",404);
  if(!doc.isCurrent)throw new WorkflowError("Une ancienne version reste en lecture seule.",409);
  if(!["DRAFT","NEEDS_INFO"].includes(doc.file.status))throw new WorkflowError("Ce dossier est en cours d’examen ou déjà traité.",409);
  if(v.details.parcelReferences.some(ref=>!doc.file.declarations.some(p=>p.reference===ref)))throw new WorkflowError("Sélectionnez les parcelles de votre dossier.");
  const previous=documentDetails.safeParse(doc.details);
  const affected=[...v.details.parcelReferences,...(previous.success?previous.data.parcelReferences:[])];
  if(doc.file.declarations.some(p=>p.status!=="PENDING"&&affected.includes(p.reference)))throw new WorkflowError("Une pièce liée à une parcelle déjà examinée doit faire l’objet d’une nouvelle demande de correction.",409);
  const changed=await tx.acquirerFile.updateMany({where:{id:doc.fileId,version:v.version},data:{version:{increment:1}}});if(changed.count!==1)throw new WorkflowError("Le dossier a changé. Rechargez la page.",409);
  await tx.document.updateMany({where:{fileId:doc.fileId,...(doc.groupId?{groupId:doc.groupId,revision:doc.revision}:{id:doc.id}),isCurrent:true},data:{details:v.details}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:doc.fileId,action:"DOCUMENT_CLASSIFIED",detail:JSON.stringify({id:doc.id,before:doc.details,after:v.details,version:v.version+1})}});
  return {success:true};
 });
}

export const MAX_CONTRACT_FILE_SIZE=20*1024*1024;
export const MAX_CONTRACT_SIZE=200*1024*1024;
export async function depositContract(userId:string,input:unknown,uploads:{name:string;buffer:Buffer}[]){
 const {z}=await import("zod");
 const v=z.object({fileId:z.string().min(1).optional(),version:z.number().int().nonnegative(),replaceId:z.string().min(1).optional(),token:z.uuid()}).strict().parse(input);
 const file=await writableFile(userId,v.fileId);
 if(!uploads.length||uploads.length>10||uploads.reduce((s,u)=>s+u.buffer.length,0)>MAX_CONTRACT_SIZE)throw new WorkflowError("Choisissez de 1 à 10 fichiers, pour un total de 200 Mo maximum.");
 const prepared=uploads.map(u=>({originalName:u.name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,160)||"document",mimeType:detectFile(u.buffer,MAX_CONTRACT_FILE_SIZE),sha256:createHash("sha256").update(u.buffer).digest("hex"),size:u.buffer.length,buffer:u.buffer,storageKey:randomUUID()}));
 const batchHash=createHash("sha256").update(JSON.stringify({fileId:file.id,version:v.version,replaceId:v.replaceId,files:prepared.map(({originalName,sha256})=>({originalName,sha256}))})).digest("hex");
 const prior=await db.document.findFirst({where:{batchId:v.token}});
 if(prior){if(prior.fileId!==file.id||prior.batchHash!==batchHash)throw new WorkflowError("Ce dépôt a déjà été utilisé pour d’autres fichiers.",409);return {success:true};}
 const paths:string[]=[];
 try{
  await mkdir(storageRoot(),{recursive:true,mode:0o700});
  for(const page of prepared){const path=join(/* turbopackIgnore: true */ storageRoot(),page.storageKey);await writeFile(path,page.buffer,{flag:"wx",mode:0o600});paths.push(path);}
  return await db.$transaction(async tx=>{
   const actor=await tx.user.findUnique({where:{id:userId}});
   const current=await tx.acquirerFile.findFirst({where:{id:file.id,acquirer:{userId}},include:{declarations:true}});
   if(!actor?.active||actor.role!=="ACQUIRER"||!current)throw new WorkflowError("Dossier inaccessible.",403);
   if(current.version!==v.version||!["DRAFT","NEEDS_INFO"].includes(current.status))throw new WorkflowError("Le dossier a changé ou est en cours d’examen. Rechargez la page.",409);
   const previous=v.replaceId?await tx.document.findFirst({where:{id:v.replaceId,fileId:file.id,isCurrent:true}}):null;
   if(v.replaceId&&!previous)throw new WorkflowError("Cette version ne peut pas être remplacée.",409);
   const metadata=previous?documentDetails.safeParse(previous.details):null;
   if(previous&&current.declarations.some(p=>p.status!=="PENDING"&&(!metadata?.success||metadata.data.parcelReferences.includes(p.reference))))throw new WorkflowError("Ce contrat concerne une parcelle déjà examinée. Contactez l’équipe pour demander une correction.",409);
   const groupId=previous?.groupId??previous?.id??randomUUID(),revision=(previous?.revision??0)+1;
   const changed=await tx.acquirerFile.updateMany({where:{id:file.id,version:v.version,status:current.status},data:{version:{increment:1}}});
   if(changed.count!==1)throw new WorkflowError("Le dossier a changé. Rechargez la page.",409);
   if(previous)await tx.document.updateMany({where:{fileId:file.id,...(previous.groupId?{groupId}:{id:previous.id}),isCurrent:true},data:{isCurrent:false,groupId}});
   for(const [i,page] of prepared.entries()){
    await tx.document.create({data:{fileId:file.id,groupId,revision,page:i+1,isCurrent:true,batchId:v.token,batchHash,originalName:page.originalName,mimeType:page.mimeType,size:page.size,sha256:page.sha256,storageKey:page.storageKey,...(metadata?.success?{details:metadata.data}:{})}});
   }
   await tx.auditEvent.create({data:{actorId:userId,objectId:file.id,action:previous?"CONTRACT_REPLACED":"CONTRACT_DEPOSITED",detail:JSON.stringify({groupId,revision,previousRevision:previous?.revision,files:prepared.map((p,i)=>({page:i+1,name:p.originalName,sha256:p.sha256})),version:v.version+1})}});
   return {success:true};
  });
 }catch(error){await Promise.all(paths.map(path=>unlink(path)));const retry=await db.document.findFirst({where:{batchId:v.token}});if(retry?.fileId===file.id&&retry.batchHash===batchHash)return {success:true};throw error;}
}
