import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { requireFinance } from "./finance";
import { WorkflowError } from "./workflow";
import type { Prisma } from "@/generated/prisma/client";
import { incidentCreateSchema,incidentProgressSchema,incidentTransitions,emptyProgress,type IncidentData,type IncidentState } from "./incident-model";
export function incidentAccess(user:{id:string;personId:string}){return {AND:[{OR:[{ownerId:user.id},{createdBy:user.id}]},{OR:[{implicatedPersonId:null},{implicatedPersonId:{not:user.personId}}]}]};}
export async function getIncident(userId:string,id:string){const actor=await requireFinance(userId);const item=await db.financeIncident.findFirst({where:{id,...incidentAccess(actor)},include:{events:{orderBy:{version:"desc"}}}});if(!item)throw new WorkflowError("Signalement inaccessible.",404);return item;}
export async function createIncident(userId:string,input:unknown){
 const v=incidentCreateSchema.parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Accès réservé au service Finance.",403);
  const owner=await tx.user.findUnique({where:{id:v.ownerId}});if(!owner?.active||owner.role!=="FINANCE_OFFICER")throw new WorkflowError("Choisissez un responsable Finance actif.");
  const implicated=v.implicatedUserId?await tx.user.findUnique({where:{id:v.implicatedUserId}}):null;if(v.implicatedUserId&&!implicated)throw new WorkflowError("Personne mise en cause introuvable.");
  if(implicated?.personId===owner.personId)throw new WorkflowError("Le responsable doit être distinct de la personne mise en cause.",403);
  const dossier=v.caseId?await tx.financeCase.findFirst({where:{id:v.caseId,ownerId:userId},select:{id:true,reference:true}}):null;if(v.caseId&&!dossier)throw new WorkflowError("Dossier inaccessible.",404);
  const {ownerId,implicatedUserId,caseId,...initial}=v;void ownerId;void implicatedUserId;void caseId;
  const data:IncidentData={initial,implicatedName:implicated?.name??"",progress:{...emptyProgress,immediateMeasure:v.immediateMeasure}};
  const item=await tx.financeIncident.create({data:{reference:`INC-${new Date().getUTCFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`,caseId:dossier?.id,caseReference:dossier?.reference??"",createdBy:userId,ownerId:owner.id,implicatedPersonId:implicated?.personId,urgency:v.urgency,title:v.title,data:data as unknown as Prisma.InputJsonValue}});
  await tx.financeIncidentEvent.create({data:{incidentId:item.id,version:1,actorId:userId,actorName:actor.name,action:"RECEIVED",reason:"Signalement enregistré.",snapshot:{status:item.status,ownerId:owner.id,ownerName:owner.name,data:data as unknown as Prisma.InputJsonValue}}});
  return {id:item.id,reference:item.reference,canRead:implicated?.personId!==actor.personId};
 });
}
export async function updateIncident(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().positive(),ownerId:z.string().min(1),status:z.enum(["RECEIVED","ANALYSIS","WAITING","RESOLVED","CONTESTED","ESCALATED","CLOSED"]),reason:z.string().trim().min(10,"Précisez le motif (10 caractères minimum).").max(2000),progress:incidentProgressSchema}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Accès réservé au service Finance.",403);
  const item=await tx.financeIncident.findFirst({where:{id:v.id,ownerId:userId,...incidentAccess(actor)}});if(!item)throw new WorkflowError("Seul le responsable du signalement peut le traiter.",403);
  const owner=await tx.user.findUnique({where:{id:v.ownerId}});if(!owner?.active||owner.role!=="FINANCE_OFFICER")throw new WorkflowError("Le responsable doit disposer d’un accès Finance actif.");
  if(owner.personId===item.implicatedPersonId)throw new WorkflowError("Le responsable doit être distinct de la personne mise en cause.",403);
  if((item.status===v.status&&item.status==="CLOSED")||(item.status!==v.status&&!incidentTransitions[item.status as IncidentState].includes(v.status)))throw new WorkflowError("Ce changement d’état n’est pas permis.",409);
  if(v.status==="ESCALATED"&&!v.progress.externalContact)throw new WorkflowError("Indiquez à qui le signalement doit être escaladé.");
  if(["RESOLVED","CLOSED"].includes(v.status)&&(!v.progress.findings||!v.progress.correction||!v.progress.decision))throw new WorkflowError("Renseignez le constat, la correction et la décision.");
  if(v.status==="CLOSED"&&(!v.progress.clientResponse||!v.progress.respondedOn||!v.progress.prevention))throw new WorkflowError("Consignez la réponse, sa date et les mesures de prévention avant clôture.");
  const today=new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Kinshasa"});
  if([v.progress.acknowledgedOn,v.progress.respondedOn].some(d=>d>today))throw new WorkflowError("Une réponse réalisée ne peut pas être datée dans le futur.");
  if(!!v.progress.firstResponse!==!!v.progress.acknowledgedOn||!!v.progress.clientResponse!==!!v.progress.respondedOn)throw new WorkflowError("Une réponse consignée doit comporter son texte et sa date.");
  const data={...(item.data as unknown as IncidentData),progress:v.progress};
  const changed=await tx.financeIncident.updateMany({where:{id:item.id,ownerId:userId,version:v.version,status:item.status},data:{ownerId:v.ownerId,status:v.status,version:{increment:1},data:data as unknown as Prisma.InputJsonValue}});if(changed.count!==1)throw new WorkflowError("Le signalement a changé. Rechargez la page.",409);
  await tx.financeIncidentEvent.create({data:{incidentId:item.id,version:v.version+1,actorId:userId,actorName:actor.name,action:v.status,reason:v.reason,snapshot:{status:v.status,ownerId:owner.id,ownerName:owner.name,data:data as unknown as Prisma.InputJsonValue}}});
  return {success:true};
 });
}
