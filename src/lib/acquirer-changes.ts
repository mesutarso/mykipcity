import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { WorkflowError, verifyParcelAccess } from "./workflow";
import { activeParcelWhere, declaredQuality } from "./parcel-access-model";
import { documentDetails } from "./dossier-model";

const requestSchema = z.object({
  kind: z.enum(["CONSOLIDATE", "TRANSFER"]),
  sourceFileId: z.string().min(1), targetFileId: z.string().min(1),
  sourceProofId: z.string().min(1), targetProofId: z.string().min(1),
  sourceDeclarationId: z.string().optional(), targetDeclarationId: z.string().optional(),
  reason: z.string().trim().min(15).max(1500), checked: z.literal(true),
}).strict();
export type AcquirerChangeInput = z.infer<typeof requestSchema>;
const actorSelect = {id:true, name:true, email:true, personId:true, role:true, active:true, accessVersion:true} as const;
async function agent(tx:Prisma.TransactionClient, id:string) {
  const actor=await tx.user.findUnique({where:{id},select:actorSelect});
  if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Action réservée à l’équipe acquéreurs.",403);
  return actor;
}
async function proof(tx:Prisma.TransactionClient,id:string,fileId:string) {
  const doc=await tx.document.findFirst({where:{id,fileId,isCurrent:true},select:{id:true,fileId:true,storageKey:true,sha256:true,size:true,details:true,originalName:true,groupId:true,revision:true}});
  if(!doc||!/^[a-f0-9-]{36}$/.test(doc.storageKey))throw new WorkflowError("Choisissez une pièce actuelle de chaque dossier.",409);
  const pages=await tx.document.findMany({where:{fileId,isCurrent:true,...(doc.groupId?{groupId:doc.groupId,revision:doc.revision}:{id:doc.id})},select:{id:true,originalName:true,storageKey:true,sha256:true,size:true,page:true},orderBy:{page:"asc"}});
  for(const page of pages){
    if(!/^[a-f0-9-]{36}$/.test(page.storageKey))throw new WorkflowError("Une preuve est indisponible.",409);
    const bytes=await readFile(join(/* turbopackIgnore: true */ resolve(/* turbopackIgnore: true */ process.env.DOCUMENTS_DIR??"./data/documents"),page.storageKey)).catch(()=>null);
    if(!bytes||bytes.length!==page.size||createHash("sha256").update(bytes).digest("hex")!==page.sha256)throw new WorkflowError("Une preuve est indisponible ou son intégrité a changé.",409);
  }
  return {...doc,pages};
}
async function snapshot(tx:Prisma.TransactionClient,v:AcquirerChangeInput) {
  const files=await tx.acquirerFile.findMany({where:{id:{in:[v.sourceFileId,v.targetFileId]}},include:{acquirer:{include:{user:{select:actorSelect}}}}});
  const source=files.find(f=>f.id===v.sourceFileId),target=files.find(f=>f.id===v.targetFileId);
  if(!source||!target||source.id===target.id||source.acquirer.mergedIntoId||target.acquirer.mergedIntoId)throw new WorkflowError("Choisissez deux dossiers distincts encore actifs.",409);
  const from=source.acquirer.user,to=target.acquirer.user;
  if(!from?.active||!to?.active||from.role!=="ACQUIRER"||to.role!=="ACQUIRER"||from.id===to.id)throw new WorkflowError("Choisissez deux comptes acquéreurs actifs et distincts.",409);
  const sourceProof=await proof(tx,v.sourceProofId,source.id),targetProof=await proof(tx,v.targetProofId,target.id);
  const groups=await tx.acquirerFile.findMany({where:{acquirer:{userId:{in:[from.id,to.id]}}},select:{id:true,version:true,status:true,acquirer:{select:{id:true,reference:true,registeredName:true,registryVersion:true,userId:true}}},orderBy:{id:"asc"}});
  const base={input:v,from,to,files:groups,sourceProof,targetProof};
  if(v.kind==="CONSOLIDATE")return {...base,transfer:null};
  const old=await tx.parcelDeclaration.findFirst({where:{id:v.sourceDeclarationId??"",fileId:source.id,...activeParcelWhere()},include:{parcel:true}});
  const next=await tx.parcelDeclaration.findFirst({where:{id:v.targetDeclarationId??"",fileId:target.id,status:"PENDING"}});
  if(!old?.parcel||!next||next.reference!==old.parcel.reference||target.status!=="SUBMITTED")throw new WorkflowError("Le nouveau titulaire doit transmettre une déclaration de la même parcelle ; l’ancien rattachement doit être actif.",409);
  if(declaredQuality(source.details,old.details)!=="HOLDER"||declaredQuality(target.details,next.details)!=="HOLDER")throw new WorkflowError("Le remplacement concerne deux titulaires. Les cotitularités et mandats se traitent séparément.",409);
  if(await tx.parcelDeclaration.count({where:{parcelId:old.parcelId,id:{not:old.id},...activeParcelWhere()}}))throw new WorkflowError("D’autres droits sont actifs sur cette parcelle. Leur situation doit être examinée avant le remplacement.",409);
  for(const [doc,reference] of [[sourceProof,old.reference],[targetProof,next.reference]] as const){
    const detail=documentDetails.safeParse(doc.details);
    if(!detail.success||!detail.data.parcelReferences.includes(reference)||!["ACQUISITION","LEASE","LAND_ACT","AMENDMENT"].includes(detail.data.category))throw new WorkflowError("Chaque preuve doit être une pièce contractuelle associée à la parcelle concernée.",409);
  }
  return {...base,transfer:{source:old,target:next}};
}
// Store plain JSON so dates compare identically after SQLite round trips.
const plain = <T>(value:T):Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export async function prepareAcquirerChange(userId:string,input:unknown) {
  const value=requestSchema.parse(input);
  return db.$transaction(async tx=>{
    const actor=await agent(tx,userId),data=await snapshot(tx,value);
    const ids=data.files.map(f=>f.id);
    if(await tx.acquirerChange.count({where:{status:"PENDING",OR:[{sourceFileId:{in:ids}},{targetFileId:{in:ids}}]}}))throw new WorkflowError("Une demande concerne déjà ces comptes. Traitez-la ou retirez-la avant de recommencer.",409);
    const item=await tx.acquirerChange.create({data:{kind:value.kind,sourceFileId:value.sourceFileId,targetFileId:value.targetFileId,preparedBy:actor.id,preparedPersonId:actor.personId,snapshot:plain(data),reason:value.reason}});
    await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:"ACQUIRER_CHANGE_REQUESTED",detail:JSON.stringify({kind:value.kind,sourceFileId:value.sourceFileId,targetFileId:value.targetFileId,reason:value.reason})}});
    return {id:item.id};
  });
}
export async function decideAcquirerChange(userId:string,input:unknown) {
  const v=z.object({id:z.string().min(1),decision:z.enum(["APPROVE","REJECT","CANCEL"]),reason:z.string().trim().min(15).max(1500),checked:z.literal(true)}).strict().parse(input);
  return db.$transaction(async tx=>{
    const actor=await agent(tx,userId),item=await tx.acquirerChange.findUnique({where:{id:v.id}});
    if(!item||item.status!=="PENDING")throw new WorkflowError("Cette demande a déjà été traitée.",409);
    const preparer=await tx.user.findUnique({where:{id:item.preparedBy}});
    if(v.decision==="CANCEL"){
      if(actor.id!==item.preparedBy)throw new WorkflowError("Seul l’auteur peut retirer sa demande.",403);
    }else if(actor.id===item.preparedBy||actor.personId===item.preparedPersonId||actor.personId===preparer?.personId)throw new WorkflowError("La décision exige une autre personne de l’équipe.",403);
    if(v.decision==="APPROVE"){
      if(!preparer?.active||preparer.role!=="ACQUIRER_AGENT")throw new WorkflowError("L’auteur n’est plus habilité. Retirez la demande et préparez un nouvel examen.",409);
      const stored=item.snapshot as {input:AcquirerChangeInput};
      const data=await snapshot(tx,requestSchema.parse(stored.input));
      if(JSON.stringify(plain(data))!==JSON.stringify(item.snapshot))throw new WorkflowError("Les dossiers, comptes ou preuves ont changé. Refusez cette demande et préparez un nouvel examen.",409);
      if(item.kind==="CONSOLIDATE"){
        const sources=data.files.filter(f=>f.acquirer.userId===data.from.id);
        await tx.acquirer.updateMany({where:{userId:data.from.id},data:{userId:data.to.id,registryVersion:{increment:1}}});
        await tx.acquirerFile.updateMany({where:{id:{in:data.files.map(f=>f.id)}},data:{version:{increment:1}}});
        await tx.user.update({where:{id:data.from.id},data:{active:false,selectedFileId:null,mergedIntoUserId:data.to.id,accessVersion:{increment:1}}});
        await tx.user.updateMany({where:{mergedIntoUserId:data.from.id},data:{mergedIntoUserId:data.to.id}});
        await tx.user.update({where:{id:data.to.id},data:{selectedFileId:item.targetFileId,accessVersion:{increment:1}}});
        await tx.session.deleteMany({where:{userId:{in:[data.from.id,data.to.id]}}});
        await tx.emailChange.updateMany({where:{userId:{in:[data.from.id,data.to.id]},completedAt:null,cancelledAt:null},data:{cancelledAt:new Date()}});
        await tx.emailDelivery.updateMany({where:{userId:data.from.id,status:"PENDING"},data:{status:"CANCELLED",payload:""}});
        await tx.invitation.updateMany({where:{acquirerId:{in:sources.map(f=>f.acquirer.id)},consumedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
        for(const file of data.files)await tx.auditEvent.create({data:{actorId:userId,objectId:file.id,action:"ACCOUNT_CONSOLIDATED",detail:JSON.stringify({changeId:item.id,preparedBy:item.preparedBy,from:data.from.id,to:data.to.id,reason:v.reason})}});
      }else{
        const transfer=data.transfer!;
        await tx.parcelDeclaration.update({where:{id:transfer.source.id},data:{accessRevokedAt:new Date(),reason:v.reason}});
        const access=await verifyParcelAccess(tx,transfer.target.id,transfer.source.parcelId!,{quality:"HOLDER",proofId:data.targetProof.id,principal:"",expiresOn:"",checked:true,sharedChecked:false});
        await tx.parcelDeclaration.update({where:{id:transfer.target.id},data:{status:"APPROVED",parcelId:transfer.source.parcelId,reason:v.reason,reviewedBy:userId,reviewedAt:new Date(),accessRevokedAt:null,accessExpiresAt:null,accessVerification:access!.record}});
        for(const fileId of [item.sourceFileId,item.targetFileId]){
          const declarations=await tx.parcelDeclaration.findMany({where:{fileId}});
          const current=data.files.find(f=>f.id===fileId)!;
          const status=declarations.some(d=>d.status==="PENDING")?(current.status==="NEEDS_INFO"?"NEEDS_INFO":"SUBMITTED"):declarations.some(d=>d.status==="APPROVED"&&!d.accessRevokedAt)?"VERIFIED":"CLOSED";
          await tx.acquirerFile.update({where:{id:fileId},data:{version:{increment:1},status}});
          await tx.auditEvent.create({data:{actorId:userId,objectId:fileId,action:"PARCEL_ACCESS_TRANSFERRED",detail:JSON.stringify({changeId:item.id,reference:transfer.source.parcel!.reference,reason:v.reason,preparedBy:item.preparedBy})}});
        }
      }
    }
    const changed=await tx.acquirerChange.updateMany({where:{id:item.id,status:"PENDING"},data:{status:v.decision==="APPROVE"?"APPROVED":v.decision==="REJECT"?"REJECTED":"CANCELLED",reviewedBy:userId,reviewReason:v.reason,reviewedAt:new Date()}});
    if(changed.count!==1)throw new WorkflowError("La demande a été traitée par une autre personne.",409);
    await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:`ACQUIRER_CHANGE_${v.decision}`,detail:JSON.stringify({reason:v.reason})}});
    return {success:true};
  });
}
export async function selectAcquirerFile(userId:string,input:unknown){
  const {fileId}=z.object({fileId:z.string().min(1)}).strict().parse(input);
  return db.$transaction(async tx=>{
    const actor=await tx.user.findUnique({where:{id:userId}});
    if(!actor?.active||actor.role!=="ACQUIRER")throw new WorkflowError("Accès réservé aux acquéreurs.",403);
    if(!await tx.acquirerFile.count({where:{id:fileId,acquirer:{userId}}}))throw new WorkflowError("Dossier inaccessible.",404);
    await tx.user.update({where:{id:userId},data:{selectedFileId:fileId}});
    return {success:true};
  });
}
