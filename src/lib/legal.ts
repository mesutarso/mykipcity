import {z} from "zod";
import {db} from "./db";
import type {Prisma} from "@/generated/prisma/client";
import {getActor,WorkflowError} from "./workflow";
import {requireAdmin} from "./team";
import {legalTemplates} from "./legal-templates";
export const legalStates:Record<string,string>={DRAFT:"À préparer",IN_REVIEW:"Visa du Cabinet attendu",REVIEWED:"Visa du Cabinet enregistré",RETURNED:"À corriger"};
export const legalDataSchema=z.object({values:z.record(z.string(),z.string().trim().max(6000)),checks:z.record(z.string(),z.object({state:z.enum(["M","V","NA"]),proofId:z.string().max(100),reason:z.string().trim().max(2000)}).strict()),proofIds:z.array(z.string().min(1)).max(100)}).strict();
export type LegalData=z.infer<typeof legalDataSchema>;
export function legalAccess(actor:{id:string;role:string}){return actor.role==="LEGAL_OFFICER"?{OR:[{legalOfficerId:actor.id},{legalRecords:{some:{reviewerId:actor.id}}}]}:actor.role==="FINANCE_OFFICER"?{ownerId:actor.id}:actor.role==="FINANCE_REVIEWER"?{reviewerId:actor.id}:actor.role==="FINANCE_VALIDATOR"?{validatorId:actor.id}:{id:"__inaccessible__"};}
export async function legalCase(userId:string,id:string){const actor=await getActor(userId);const item=await db.financeCase.findFirst({where:{id,...legalAccess(actor)},include:{legalRecords:{orderBy:{updatedAt:"desc"}},requirements:{include:{documents:true}}}});if(!item)throw new WorkflowError("Dossier juridique inaccessible.",404);return {actor,item};}
export async function assignLegal(userId:string,input:unknown){const v=z.object({id:z.string().min(1),version:z.number().int().positive(),targetId:z.string().min(1),reason:z.string().trim().min(10).max(1000)}).strict().parse(input);return db.$transaction(async tx=>{await requireAdmin(tx,userId);const target=await tx.user.findUnique({where:{id:v.targetId}});if(!target?.active||target.role!=="LEGAL_OFFICER")throw new WorkflowError("Choisissez un intervenant actif du Cabinet.",409);const previous=await tx.financeCase.findUnique({where:{id:v.id}});if(!previous)throw new WorkflowError("Dossier introuvable.",404);if(previous.legalOfficerId===target.id)throw new WorkflowError("Cet intervenant est déjà affecté.");if(await tx.legalRecord.count({where:{caseId:v.id,status:"IN_REVIEW"}})||await tx.originalEvent.count({where:{original:{caseId:v.id},status:"PENDING"}}))throw new WorkflowError("Terminez ou retournez les visas en attente avant de réattribuer ce dossier.",409);const changed=await tx.financeCase.updateMany({where:{id:v.id,version:v.version},data:{legalOfficerId:target.id,version:{increment:1}}});if(!changed.count)throw new WorkflowError("Le dossier a changé.",409);await tx.auditEvent.create({data:{actorId:userId,objectId:v.id,action:"LEGAL_ASSIGNED",detail:JSON.stringify({previousId:previous.legalOfficerId,targetId:target.id,reason:v.reason})}});return {success:true};});}
export async function saveLegal(userId:string,input:unknown){
 const v=z.object({id:z.string().optional(),caseId:z.string().min(1),version:z.number().int().nonnegative(),code:z.string(),title:z.string().trim().min(3).max(160),data:legalDataSchema,reason:z.string().trim().min(10).max(1000)}).strict().parse(input);
 const template=legalTemplates[v.code];if(!template)throw new WorkflowError("Modèle inconnu.");
 const fields=new Set(template.sections.flatMap(s=>s.fields.map(f=>f.key))),checks=new Set(template.sections.flatMap(s=>s.checks.map(c=>c.key)));
 if(Object.keys(v.data.values).some(k=>!fields.has(k))||Object.keys(v.data.checks).some(k=>!checks.has(k)))throw new WorkflowError("Le formulaire contient des champs inconnus.");
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="LEGAL_OFFICER")throw new WorkflowError("Accès réservé au Cabinet juridique.",403);
  const item=await tx.financeCase.findFirst({where:{id:v.caseId,legalOfficerId:userId}});if(!item)throw new WorkflowError("Dossier non attribué.",404);
  const proofIds=[...new Set([...v.data.proofIds,...Object.values(v.data.checks).map(c=>c.proofId).filter(Boolean)])];
  for(const id of proofIds){const d=await tx.financeDocument.findUnique({where:{id},include:{requirement:true}});if(!d||d.requirement.caseId!==item.id||d.status!=="ACCEPTED"||d.revision!==d.requirement.version)throw new WorkflowError("Une preuve n’est pas une pièce actuelle contrôlée de ce dossier.",409);}
  const data={...v.data,proofIds};let id=v.id;const version=v.id?v.version+1:1;
  if(id){const changed=await tx.legalRecord.updateMany({where:{id,caseId:item.id,code:v.code,version:v.version,status:{in:["DRAFT","RETURNED"]}},data:{title:v.title,data,version:{increment:1},status:"DRAFT",authorId:userId}});if(!changed.count)throw new WorkflowError("La fiche a changé ou son visa est enregistré.",409);}else{if(v.version!==0)throw new WorkflowError("Version invalide.");id=(await tx.legalRecord.create({data:{caseId:item.id,code:v.code,title:v.title,authorId:userId,data}})).id;}
  await tx.legalRevision.create({data:{recordId:id,version,action:"SAVE",actorId:userId,actorName:actor.name,actorPersonId:actor.personId,reason:v.reason,data}});return {id};
 });
}
export async function decideLegal(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().positive(),action:z.enum(["SUBMIT","VISA","RETURN","REOPEN"]),reviewerId:z.string().optional(),part:z.number().int().min(1).max(2).optional(),reason:z.string().trim().min(10).max(2000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="LEGAL_OFFICER")throw new WorkflowError("Accès réservé au Cabinet.",403);
  const record=await tx.legalRecord.findUnique({where:{id:v.id},include:{case:true,revisions:true}});if(!record||record.version!==v.version)throw new WorkflowError("Fiche introuvable ou modifiée.",409);
  const data=legalDataSchema.parse(record.data);let reviewerId=record.reviewerId;
  if(v.action==="REOPEN"){
   if(record.case.legalOfficerId!==userId||record.status!=="REVIEWED")throw new WorkflowError("Cette fiche ne peut pas être reprise.",403);
   const changed=await tx.legalRecord.updateMany({where:{id:record.id,version:v.version,status:"REVIEWED"},data:{status:"DRAFT",version:{increment:1}}});if(!changed.count)throw new WorkflowError("La fiche a changé.",409);
   await tx.legalRevision.create({data:{recordId:record.id,version:v.version+1,action:"REOPEN",actorId:userId,actorName:actor.name,actorPersonId:actor.personId,reason:v.reason,data:record.data as Prisma.InputJsonValue}});return {success:true};
  }
  const part=v.action==="SUBMIT"?(v.part??1):record.reviewPart;
  if(v.action==="SUBMIT"){
   if(record.case.legalOfficerId!==userId||record.status!=="DRAFT")throw new WorkflowError("Cette fiche ne peut pas être soumise.",403);
   const reviewer=v.reviewerId?await tx.user.findUnique({where:{id:v.reviewerId}}):null;
   if(!reviewer?.active||reviewer.role!=="LEGAL_OFFICER"||reviewer.personId===actor.personId||record.revisions.some(r=>r.action==="SAVE"&&r.actorPersonId===reviewer.personId))throw new WorkflowError("Choisissez un autre intervenant du Cabinet, distinct des préparateurs.",403);
   reviewerId=reviewer.id;
   const template=legalTemplates[record.code];
   if(template.sections.filter((_,i)=>i===part-1).some(s=>s.fields.some(f=>!data.values[f.key])||s.checks.some(c=>{const check=data.checks[c.key];return !check||check.state==="M"||!check.reason||(check.state==="V"&&!check.proofId);})))throw new WorkflowError("Complétez chaque rubrique et justifiez les contrôles avant le visa. Les points non applicables doivent être motivés.");
   if(!data.proofIds.length)throw new WorkflowError("Joignez les références des pièces examinées.");
  }else if(record.status!=="IN_REVIEW"||record.reviewerId!==userId||record.revisions.some(r=>r.action==="SAVE"&&r.actorPersonId===actor.personId))throw new WorkflowError("Ce visa ne vous est pas attribué ou manque d’indépendance.",403);
  if(v.action!=="RETURN")for(const id of data.proofIds){const d=await tx.financeDocument.findUnique({where:{id},include:{requirement:true}});if(!d||d.requirement.caseId!==record.caseId||d.status!=="ACCEPTED"||d.revision!==d.requirement.version)throw new WorkflowError("Une preuve a changé. Corrigez la fiche.",409);}
  const status=v.action==="SUBMIT"?"IN_REVIEW":v.action==="VISA"?"REVIEWED":"RETURNED";
  const changed=await tx.legalRecord.updateMany({where:{id:record.id,version:v.version,status:record.status},data:{status,reviewerId,reviewPart:part,version:{increment:1}}});if(!changed.count)throw new WorkflowError("Une décision vient d’être enregistrée.",409);
  const proofSnapshot=await tx.financeDocument.findMany({where:{id:{in:data.proofIds}},select:{id:true,sha256:true,originalName:true,revision:true}});
  await tx.legalRevision.create({data:{recordId:record.id,version:v.version+1,action:v.action,actorId:userId,actorName:actor.name,actorPersonId:actor.personId,reason:v.reason,data:{...data,proofSnapshot,reviewPart:part}}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:record.caseId,action:`LEGAL_${v.action}`,detail:JSON.stringify({recordId:record.id,code:record.code,version:v.version+1,reason:v.reason})}});return {success:true};
 });
}
