import { z } from "zod";
import { db } from "./db";
import { WorkflowError } from "./workflow";
import { authorizationSchema,type AuthorizationPayload } from "./authorization-model";
import { requestSchema,budgetSchema,categories,periods,money,minorUnits,qualities } from "./finance-model";
import type { Prisma } from "@/generated/prisma/client";
export async function saveAuthorization(userId:string,input:unknown){
 const v=z.object({id:z.string().optional(),version:z.number().int().positive().optional(),caseId:z.string().min(1),cycle:z.number().int().positive(),data:authorizationSchema}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Accès réservé au référent Finance.",403);
  const item=await tx.financeCase.findFirst({where:{id:v.caseId,ownerId:userId,status:"INTERNALLY_VALIDATED",reviewCycle:v.cycle,reopeningRequestId:null}});
  if(!item)throw new WorkflowError("Le dossier doit avoir une validation interne actuelle et vous être attribué.",409);
  const institution=await tx.financeInstitution.findFirst({where:{id:v.data.institutionId,ownerId:userId},select:{id:true,name:true,branch:true,address:true}});
  if(!institution)throw new WorkflowError("Institution inaccessible.",404);
  const review=await tx.financeReview.findUniqueOrThrow({where:{caseId_cycle:{caseId:item.id,cycle:v.cycle}}});
  const snapshot=review.snapshot as {request:unknown;budget:unknown;documents:AuthorizationPayload["documents"]};
  const documents=v.data.documentIds.map(id=>{const doc=snapshot.documents.find(d=>d.id===id);if(!doc)throw new WorkflowError("Une pièce ne figure pas dans la version contrôlée du dossier.",400);return {id:doc.id,label:doc.label,name:doc.name,revision:doc.revision,sha256:doc.sha256};});
  const request=requestSchema.parse(snapshot.request),budget=budgetSchema.parse(snapshot.budget);
  const information:AuthorizationPayload["information"]=[];
  const reference=`${item.reference} · Examen ${v.cycle}`;
  if(v.data.scopes.includes("IDENTITY"))information.push({label:"Identité et contacts",reference,values:{Demandeur:request.applicantName,Qualité:qualities[request.quality],Téléphone:request.phone,"E-mail":request.email}});
  if(v.data.scopes.includes("LAND"))information.push({label:"Terrain et projet",reference,values:{"Référence acquéreur":request.acquirerReference,Projet:request.project,Description:request.description,Calendrier:request.calendar}});
  if(v.data.scopes.includes("INCOME"))budget.lines.filter(l=>["REGULAR","VARIABLE","ESSENTIAL","DEBT","COMMITMENT"].includes(l.category)).forEach((l,i)=>information.push({label:`Revenus et charges · ${i+1}`,reference,values:{Poste:categories[l.category],Montant:money(minorUnits(l.amount),l.currency),Période:periods[l.period],Justificatif:l.evidence}}));
  if(v.data.scopes.includes("BUDGET")){
   information.push({label:"Plan de financement",reference,values:{"Coût estimé":request.projectCost?money(minorUnits(request.projectCost),request.projectCurrency):"Non renseigné",Apport:request.contribution?money(minorUnits(request.contribution),request.contributionCurrency):"Non renseigné","Montant recherché":request.requested?money(minorUnits(request.requested),request.requestedCurrency):"Non renseigné"}});
   budget.lines.filter(l=>["WORKS","FEES","FINANCING","PROVISION","RESOURCES","INSTALLMENT"].includes(l.category)).forEach((l,i)=>information.push({label:`Budget · ${i+1}`,reference,values:{Poste:categories[l.category],Montant:money(minorUnits(l.amount),l.currency),Période:periods[l.period],Justificatif:l.evidence}}));
  }
  const payload:AuthorizationPayload={input:v.data,caseReference:item.reference,applicantName:request.applicantName,cycle:v.cycle,institution,documents,information};
  let id=v.id;const version=id?(v.version??0)+1:1;
  if(id){if(!v.version)throw new WorkflowError("Version manquante.");const changed=await tx.financeAuthorization.updateMany({where:{id,caseId:item.id,cycle:v.cycle,version:v.version,status:"DRAFT"},data:{payload:payload as unknown as Prisma.InputJsonValue,version:{increment:1}}});if(changed.count!==1)throw new WorkflowError("Cette autorisation a changé ou n’est plus modifiable.",409);}
  else id=(await tx.financeAuthorization.create({data:{caseId:item.id,cycle:v.cycle,payload:payload as unknown as Prisma.InputJsonValue}})).id;
  await tx.financeAuthorizationRevision.create({data:{authorizationId:id,version,status:"DRAFT",payload:payload as unknown as Prisma.InputJsonValue,actorId:userId}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:"FINANCE_AUTHORIZATION_SAVED",detail:`${id} v${version}`}});
  return {id};
 });
}
export async function changeAuthorization(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().positive(),action:z.enum(["PREPARE","WITHDRAW"]),reason:z.string().trim().min(10).max(1000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="FINANCE_OFFICER")throw new WorkflowError("Accès réservé au référent Finance.",403);
  const item=await tx.financeAuthorization.findFirst({where:{id:v.id,case:{ownerId:userId}},include:{case:true}});
  if(!item||item.version!==v.version||item.status==="WITHDRAWN")throw new WorkflowError("Autorisation inaccessible ou modifiée.",409);
  if(v.action==="PREPARE"){
   const payload=item.payload as unknown as AuthorizationPayload;
   if(item.case.reopeningRequestId||item.status!=="DRAFT"||item.case.status!=="INTERNALLY_VALIDATED"||item.cycle!==item.case.reviewCycle)throw new WorkflowError("La version contrôlée n’est plus actuelle.",409);
   if(payload.input.endsOn<new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Kinshasa"}))throw new WorkflowError("La période prévue est expirée.");
   for(const proof of payload.documents){const doc=await tx.financeDocument.findUnique({where:{id:proof.id},include:{requirement:true}});if(!doc||doc.requirement.caseId!==item.caseId||doc.status!=="ACCEPTED"||doc.revision!==doc.requirement.version||doc.sha256!==proof.sha256)throw new WorkflowError("Une pièce doit être contrôlée à nouveau.",409);}
  }
  const status=v.action==="PREPARE"?"READY_FOR_SIGNATURE":"WITHDRAWN";
  const changed=await tx.financeAuthorization.updateMany({where:{id:item.id,version:v.version,status:item.status},data:{status,version:{increment:1}}});if(changed.count!==1)throw new WorkflowError("L’autorisation a changé.",409);
  await tx.financeAuthorizationRevision.create({data:{authorizationId:item.id,version:v.version+1,status,payload:item.payload as Prisma.InputJsonValue,actorId:userId,reason:v.reason}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.caseId,action:`FINANCE_AUTHORIZATION_${v.action}`,detail:JSON.stringify({id:item.id,reason:v.reason})}});
  return {success:true};
 });
}
