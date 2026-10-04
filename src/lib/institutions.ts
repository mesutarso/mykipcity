import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { requireFinance } from "./finance";
import { WorkflowError } from "./workflow";
import { institutionSchema,offerSchema } from "./institution-model";
export async function saveInstitution(userId:string,input:unknown){
 await requireFinance(userId);
 const v=z.object({id:z.string().optional(),version:z.number().int().positive().optional(),data:institutionSchema}).strict().parse(input);
 const identityKey=`${v.data.name.toLocaleLowerCase()}|${v.data.branch.toLocaleLowerCase()}`;
 try{return await db.$transaction(async tx=>{
  let id=v.id;
  if(id){
   if(!v.version)throw new WorkflowError("Version manquante.");
   const changed=await tx.financeInstitution.updateMany({where:{id,ownerId:userId,version:v.version},data:{...v.data,identityKey,version:{increment:1}}});
   if(changed.count!==1)throw new WorkflowError("Fiche inaccessible ou modifiée. Rechargez la page.",409);
  }else{id=(await tx.financeInstitution.create({data:{...v.data,ownerId:userId,identityKey}})).id;}
  await tx.auditEvent.create({data:{actorId:userId,objectId:id,action:"FINANCE_INSTITUTION_SAVED",detail:JSON.stringify(v.data)}});return {id};
 });}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002")throw new WorkflowError("Cette institution et cette agence figurent déjà dans votre répertoire.",409);throw e;}
}
export async function saveOffer(userId:string,input:unknown){
 await requireFinance(userId);
 const v=z.object({id:z.string().optional(),version:z.number().int().positive().optional(),caseId:z.string(),institutionId:z.string(),data:offerSchema}).strict().parse(input);
 return db.$transaction(async tx=>{
  const item=await tx.financeCase.findFirst({where:{id:v.caseId,ownerId:userId,status:"DRAFT"}});
  // An existing offer remains attached to its dossier after reassignment.
  // Creating an offer still requires an institution owned by the current referent.
  const existing=v.id?await tx.financeOffer.findFirst({where:{id:v.id,caseId:v.caseId,institutionId:v.institutionId}}):null;
  const institution=await tx.financeInstitution.findFirst({where:{id:v.institutionId,...(existing?{}:{ownerId:userId})}});
  if(!item||!institution)throw new WorkflowError("Dossier ou institution inaccessible.",404);
  if(v.data.documentId){
   const doc=await tx.financeDocument.findFirst({where:{id:v.data.documentId,requirement:{caseId:item.id}},include:{requirement:true}});
   if(!doc||doc.status!=="ACCEPTED"||doc.revision!==doc.requirement.version)throw new WorkflowError("Choisissez la dernière version contrôlée d’une pièce de ce dossier.");
  }
  let id=v.id;const version=id?(v.version??0)+1:1;
  if(id){
   if(!v.version)throw new WorkflowError("Version manquante.");
   const changed=await tx.financeOffer.updateMany({where:{id,caseId:item.id,institutionId:institution.id,version:v.version},data:{data:v.data,version:{increment:1}}});
   if(changed.count!==1)throw new WorkflowError("Offre inaccessible ou modifiée. Rechargez la page.",409);
  }else{
   const {name,branch,contactName,contactRole,email,phone,address}=institution;
   id=(await tx.financeOffer.create({data:{caseId:item.id,institutionId:institution.id,institutionSnapshot:{name,branch,contactName,contactRole,email,phone,address},data:v.data}})).id;
  }
  await tx.financeOfferRevision.create({data:{offerId:id,version,data:v.data,actorId:userId}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:"FINANCE_OFFER_SAVED",detail:`${id} v${version}`}});return {id};
 });
}
