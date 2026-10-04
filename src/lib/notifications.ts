import {contactQueue} from "./management";
import { z } from "zod";
import { db } from "./db";
import { getActor,WorkflowError } from "./workflow";
import { memberPublications } from "./publications";
import { memberFinance } from "./member-finance";

type Notice={id:string;title:string;href:string;createdAt:Date};
const decisions:Record<string,string>={ACCOUNT_CONSOLIDATED:"Vos dossiers ont été regroupés",PARCEL_ACCESS_TRANSFERRED:"Le titulaire de l’accès a changé",PARCEL_ACCESS_REEXAMINE:"Vos droits doivent être réexaminés",IDENTITY_CORRECTED:"L’identité de votre dossier a été corrigée",PARCEL_ACCESS_REVOKE:"Un accès à une parcelle a été retiré",PARCEL_ACCESS_RENEW:"Vos droits sur une parcelle ont été renouvelés",PARCEL_APPROVED:"Un rattachement a été validé",PARCEL_REJECTED:"Une décision sur votre parcelle est disponible",PARCEL_NEEDS_INFO:"Un complément vous est demandé"};
// Build the inbox from currently accessible records. Withdrawal, transfer or loss of
// a parcel permission therefore removes the corresponding notice immediately.
export async function notifications(userId:string){
 const actor=await getActor(userId);const items:Notice[]=[];
 if(actor.role==="ACQUIRER"||actor.role==="ACQUIRER_AGENT"){
  const files=actor.role==="ACQUIRER"?{acquirer:{userId}}:{OR:[await contactQueue(userId,"mine"),await contactQueue(userId,"unassigned")]};
  const messages=await db.message.findMany({where:{file:files,authorId:{not:userId},...(actor.role==="ACQUIRER_AGENT"?{author:{role:"ACQUIRER"}}:{})},orderBy:{createdAt:"desc"},take:100});
  items.push(...messages.map(m=>({id:`message:${m.id}`,title:m.subject||"Nouveau message",href:actor.role==="ACQUIRER"?`/mykipcity/contact?dossier=${m.fileId}`:`/gestion/acquereurs/${m.fileId}#echanges`,createdAt:m.createdAt})));
 }
 if(actor.role==="ACQUIRER_AGENT"){
  const pending=await db.acquirerChange.findMany({where:{status:"PENDING",preparedPersonId:{not:actor.personId},preparedBy:{not:userId}},orderBy:{createdAt:"desc"},take:30});
  items.push(...pending.map(i=>({id:`acquirer-change:${i.id}`,title:i.kind==="CONSOLIDATE"?"Regroupement de comptes à examiner":"Changement de titulaire à examiner",href:`/gestion/changements/${i.id}`,createdAt:i.createdAt})));
 }
 if(actor.role==="ACQUIRER"){
  const files=await db.acquirerFile.findMany({where:{acquirer:{userId}},select:{id:true}});
  if(files.length){
   const [events,documents,publications,finance]=await Promise.all([
    db.auditEvent.findMany({where:{objectId:{in:files.map(f=>f.id)},action:{in:Object.keys(decisions)}},orderBy:{createdAt:"desc"},take:30}),
    db.memberDocument.findMany({where:{fileId:{in:files.map(f=>f.id)}},include:{versions:{orderBy:{revision:"desc"},take:1}},orderBy:{updatedAt:"desc"},take:30}),
    memberPublications(userId),memberFinance(userId),
   ]);
   items.push(...events.map(e=>({id:`decision:${e.id}`,title:decisions[e.action],href:`/mon-dossier?dossier=${e.objectId}`,createdAt:e.createdAt})));
   for(const d of documents){if(d.direction==="RECEIVED"&&(!d.versions.length||d.closedAt))continue;items.push({id:`document:${d.id}:${d.version}`,title:d.closedAt?`Demande annulée : ${d.title}`:d.direction==="RECEIVED"?`Document reçu : ${d.title}`:!d.versions[0]||d.versions[0].status==="NEEDS_INFO"?`Pièce demandée : ${d.title}`:d.versions[0].status==="ACCEPTED"?`Pièce contrôlée : ${d.title}`:`Pièce reçue par l’équipe : ${d.title}`,href:`/mykipcity/documents?dossier=${d.fileId}`,createdAt:d.updatedAt});}
   items.push(...publications.items.map(p=>({id:`publication:${p.id}:${p.publishedAt?.getTime()}`,title:p.title,href:`/mykipcity/informations/${p.id}`,createdAt:p.publishedAt!})));
   items.push(...finance.map(f=>({id:`finance:${f.id}:${f.publishedAt?.getTime()}`,title:f.content.title,href:"/mykipcity/finance",createdAt:f.publishedAt!})));
   const reqs=await db.financeRequirement.findMany({where:{sharedAt:{not:null},case:{acquirer:{userId},memberUpdate:{visible:true}}},include:{case:{select:{acquirerId:true,memberUpdate:{select:{audienceId:true}}}}},take:30,orderBy:{sharedAt:"desc"}});
   // Audience must still be the one explicitly chosen when the piece was shared.
   for(const r of reqs)if(r.memberAudienceId===r.case.acquirerId&&r.memberAudienceId===r.case.memberUpdate?.audienceId&&finance.length)items.push({id:`finance-piece:${r.id}:${r.sharingVersion}:${r.version}`,title:`Pièce Finance : ${r.label}`,href:"/mykipcity/finance",createdAt:r.sharedAt!});
  }
 }
 if(actor.role==="FINANCE_OFFICER"){
  const docs=await db.financeDocument.findMany({where:{status:"PENDING",requirement:{case:{ownerId:userId}}},include:{requirement:{select:{label:true,caseId:true}}},orderBy:{createdAt:"desc"},take:40});
  items.push(...docs.map(d=>({id:`finance-document:${d.id}`,title:`Pièce à examiner : ${d.requirement.label}`,href:`/finance/${d.requirement.caseId}?tab=pieces`,createdAt:d.createdAt})));
 }
 if(actor.role==="FINANCE_REVIEWER"||actor.role==="FINANCE_VALIDATOR"){
  const cases=await db.financeCase.findMany({where:actor.role==="FINANCE_REVIEWER"?{reviewerId:userId,status:"IN_REVIEW"}:{validatorId:userId,status:"IN_VALIDATION"},orderBy:{updatedAt:"desc"},take:40});
  items.push(...cases.map(c=>({id:`review:${c.id}:${c.reviewCycle}:${c.status}`,title:`Dossier ${c.reference} à examiner`,href:`/finance/controles/${c.id}`,createdAt:c.updatedAt})));
 }
 if(actor.role==="FINANCE_VALIDATOR"){
  const cases=await db.financeCase.findMany({where:{validatorId:userId,status:"INTERNALLY_VALIDATED",reopeningRequestId:{not:null}},orderBy:{updatedAt:"desc"},take:40});
  items.push(...cases.map(c=>({id:`reopening:${c.reopeningRequestId}`,title:`Réouverture demandée : ${c.reference}`,href:`/finance/controles/${c.id}`,createdAt:c.updatedAt})));
 }
 if(actor.role==="FINANCE_OFFICER"){
  const owned=await db.financeCase.findMany({where:{ownerId:userId},select:{id:true}});
  const events=await db.financeReviewEvent.findMany({where:{caseId:{in:owned.map(c=>c.id)},action:{in:["APPROVE_REOPEN","REJECT_REOPEN"]}},orderBy:{createdAt:"desc"},take:30});
  items.push(...events.map(e=>({id:`reopening-decision:${e.id}`,title:e.action==="APPROVE_REOPEN"?"Correction du dossier autorisée":"Réouverture du dossier refusée",href:`/finance/${e.caseId}?tab=controle`,createdAt:e.createdAt})));
 }
 if(actor.role==="LEGAL_OFFICER"){
  const records=await db.legalRecord.findMany({where:{reviewerId:userId,status:"IN_REVIEW"},orderBy:{updatedAt:"desc"},take:40});
  items.push(...records.map(r=>({id:`legal:${r.id}:${r.version}`,title:`Visa demandé : ${r.code}`,href:`/juridique/${r.caseId}/${r.id}`,createdAt:r.updatedAt})));
 }
 if(actor.role==="FINANCE_REVIEWER"||actor.role==="FINANCE_OFFICER"){
  const pending=actor.role==="FINANCE_REVIEWER";
  const events=await db.loanEvent.findMany({where:{status:pending?"PENDING":{in:["ACCEPTED","REJECTED"]},loan:{case:pending?{reviewerId:userId,status:"INTERNALLY_VALIDATED"}:{ownerId:userId}}},include:{loan:{select:{caseId:true,reference:true}}},orderBy:{createdAt:"desc"},take:40});
  items.push(...events.map(e=>({id:`loan:${e.id}:${e.status}`,title:pending?`Prêt ${e.loan.reference} : fait à contrôler`:e.status==="ACCEPTED"?`Prêt ${e.loan.reference} : contrôle enregistré`:`Prêt ${e.loan.reference} : correction demandée`,href:`/finance/${e.loan.caseId}/prets`,createdAt:e.reviewedAt??e.createdAt})));
 }
 if(actor.role==="LEGAL_OFFICER"){
  const records=await db.originalEvent.findMany({where:{OR:[{reviewerId:userId,status:"PENDING"},{original:{case:{legalOfficerId:userId}}}]},include:{original:{select:{reference:true}}},orderBy:{createdAt:"desc"},take:40});
  items.push(...records.map(e=>({id:`original:${e.id}:${e.status}`,title:`Original ${e.original.reference} : ${e.status==="PENDING"?(e.kind==="LOSS"?"perte déclarée à contrôler":e.kind==="DAMAGE"?"détérioration déclarée à contrôler":"contrôle attendu"):e.status==="ACCEPTED"?"contrôle enregistré":e.status==="REJECTED"?"correction demandée":"saisie retirée"}`,href:`/juridique/originaux/${e.originalId}`,createdAt:e.reviewedAt??e.createdAt})));
 }
 const latest=items.sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()||a.id.localeCompare(b.id)).slice(0,100);
 const receipts=await db.notificationReceipt.findMany({where:{userId,notificationId:{in:latest.map(i=>i.id)}}});
 return latest.map(item=>({...item,read:receipts.some(r=>r.notificationId===item.id)}));
}
export async function markNotifications(userId:string,input:unknown){
 const {ids}=z.object({ids:z.array(z.string().min(1).max(200)).min(1).max(100)}).strict().parse(input);
 const visible=await notifications(userId);
 const actor=await getActor(userId);
 const messageIds=ids.filter(id=>id.startsWith("message:")).map(id=>id.slice(8));
 const olderMessages=actor.role==="ACQUIRER"||actor.role==="ACQUIRER_AGENT"?await db.message.findMany({where:{id:{in:messageIds},authorId:{not:userId},...(actor.role==="ACQUIRER"?{file:{acquirer:{userId}}}:{author:{role:"ACQUIRER"}})},select:{id:true}}):[];
 if(ids.some(id=>!visible.some(n=>n.id===id)&&!olderMessages.some(m=>id===`message:${m.id}`)))throw new WorkflowError("Une notification n’est plus accessible. Rechargez la page.",409);
 await db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active)throw new WorkflowError("Compte indisponible.",403);
  for(const id of new Set(ids))await tx.notificationReceipt.upsert({where:{userId_notificationId:{userId,notificationId:id}},create:{userId,notificationId:id},update:{}});
 });
 return {success:true};
}
