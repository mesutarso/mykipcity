import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("Équipe : invitations, habilitations et révocation des sessions", async t => {
 const root=mkdtempSync(join(tmpdir(),"kip-team-"));
 process.env.DOCUMENTS_DIR=`${root}/documents`;process.env.DATABASE_URL=`file:${root}/test.db`;process.env.DEMO_MODE="true";process.env.BETTER_AUTH_URL="http://127.0.0.1:3200";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db");const team=await import("../src/lib/team");const workflow=await import("../src/lib/workflow");
 const invitation={name:"Collègue test",email:"colleague@test.invalid",role:"FINANCE_OFFICER"};
 const token=(url:string)=>url.split("/").at(-1)!;
 const activate=(value:string)=>team.activateStaff({token:value,password:"Test-Colleague-2026!",accepted:true});
 try {
  for(const [id,role] of [["admin","ADMIN"],["admin2","ADMIN"],["agent","ACQUIRER_AGENT"],["buyer","ACQUIRER"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  await t.test("Administration réservée, sans accès métier implicite",async()=>{
   for(const id of ["agent","buyer"])await assert.rejects(team.inviteStaff(id,invitation),/réservé/);
   await assert.rejects(workflow.requireStaff("admin"),/réservée/);
   const {requireFinance}=await import("../src/lib/finance");await assert.rejects(requireFinance("admin"),/réservé/);
   await assert.rejects(team.inviteStaff("admin",{...invitation,role:"SUPERADMIN"}));
  });
  await t.test("Liens renouvelés et révoqués inutilisables, activation unique",async()=>{
   const first=await team.inviteStaff("admin",invitation);
   await assert.rejects(team.inviteStaff("admin",invitation),/invitation existe/);
   const invite=await db.staffInvitation.findUniqueOrThrow({where:{email:invitation.email}});
   assert.notEqual(invite.tokenHash,token(first.url));
   const next=await team.manageStaffInvitation("admin",{id:invite.id,version:1,action:"renew"});
   assert.ok("url" in next);await assert.rejects(activate(token(first.url)),/expirée/);
   await assert.rejects(team.manageStaffInvitation("admin",{id:invite.id,version:1,action:"revoke"}),/changé/);
   await team.manageStaffInvitation("admin",{id:invite.id,version:2,action:"revoke"});
   await assert.rejects(activate(token(next.url!)),/expirée/);
   const last=await team.manageStaffInvitation("admin",{id:invite.id,version:3,action:"renew"});assert.ok(last.url);
   const results=await Promise.allSettled([activate(token(last.url)),activate(token(last.url))]);
   assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
   const user=await db.user.findUniqueOrThrow({where:{email:invitation.email}});assert.equal(user.role,"FINANCE_OFFICER");assert.equal(user.personId,invite.personId);
   assert.equal(await db.account.count({where:{userId:user.id}}),1);
   await assert.rejects(activate(token(last.url)),/expirée/);
  });
  await t.test("Expiration et collision avec un acquéreur bloquées",async()=>{
   await db.acquirer.create({data:{email:"reserved@test.invalid",reference:"RESERVED",registeredName:"Réservé",personId:"reserved"}});
   await assert.rejects(team.inviteStaff("admin",{...invitation,email:"reserved@test.invalid"}),/appartient/);
   const link=await team.inviteStaff("admin",{...invitation,email:"expired@test.invalid"});
   await db.staffInvitation.update({where:{email:"expired@test.invalid"},data:{expiresAt:new Date(0)}});
   await assert.rejects(activate(token(link.url)),/expirée/);
  });
  await t.test("Suspension ferme les sessions, versions obsolètes et auto-modification refusées",async()=>{
   const user=await db.user.findUniqueOrThrow({where:{email:invitation.email}});
   await db.session.create({data:{id:"session",token:"session-token",userId:user.id,expiresAt:new Date(Date.now()+3600000)}});
   const edit={id:user.id,version:0,role:"FINANCE_OFFICER",active:false,reason:"Fin de mission"};
   await assert.rejects(team.updateStaff("agent",edit),/réservé/);
   await team.updateStaff("admin",edit);assert.equal(await db.session.count({where:{userId:user.id}}),0);
   await assert.rejects(workflow.getActor(user.id),/suspendu/);
   await assert.rejects(team.updateStaff("admin",edit),/changé/);
   await assert.rejects(team.updateStaff("admin",{...edit,id:"admin"}),/propre accès/);
   await assert.rejects(team.updateStaff("admin",{...edit,id:"buyer"}),/introuvable/);
   await team.updateStaff("admin",{...edit,version:1,active:true});assert.equal((await workflow.getActor(user.id)).active,true);
   await db.financeInstitution.create({data:{ownerId:user.id,identityKey:"test",name:"Test",branch:"",contactName:"",contactRole:"",email:"",phone:"",address:"",notes:""}});
   await assert.rejects(team.updateStaff("admin",{...edit,version:2,role:"ACQUIRER_AGENT"}),/réattribution/);
   assert.equal(await db.auditEvent.count({where:{action:"STAFF_ACCESS_CHANGED",objectId:user.id}}),2);
  });
  await t.test("Réattribution : accès transférés, pièces et offres conservées, conflits refusés",async()=>{
   const {reassignFinance}=await import("../src/lib/assignments");
   const finance=await import("../src/lib/finance");const docs=await import("../src/lib/finance-documents");const offers=await import("../src/lib/institutions");
   const {offerSchema}=await import("../src/lib/institution-model");
   for(const id of ["source","destination","third"])await db.user.create({data:{id,role:"FINANCE_OFFICER",name:id,email:`${id}@test.invalid`,personId:id}});
   const item=await db.financeCase.create({data:{reference:"FIN-TRANSFER",ownerId:"source",applicantName:"Fictif",pathway:"HABITAT",request:{}}});
   const req=await docs.addRequirement("source",{caseId:item.id,category:"BANK",label:"Offre fictive"});
   const doc=await docs.depositFinanceDocument("source",{requirementId:req.id,version:0},"offre.pdf",Buffer.from("%PDF-1.4 TEST"));
   await docs.reviewFinanceDocument("source",{id:doc.id,decision:"ACCEPTED",reason:"Document fictif contrôlé"});
   const institution=await offers.saveInstitution("source",{data:{name:"Banque fictive",branch:"Agence",contactName:"Contact",contactRole:"",email:"",phone:"",address:"",notes:"Note du répertoire source"}});
   const data=offerSchema.parse({product:"Offre fictive",amount:"100",currency:"USD",durationMonths:"",responseDate:"",validUntil:"",author:"",writtenReference:"",documentId:doc.id,rateMethod:"UNKNOWN",eligibility:"",security:"",pricing:"",schedule:"",disbursement:"",defaultTerms:"",requiredDocuments:"",confirmations:"",complaints:"",kipcityTerms:"",commission:"",support:"",internalNotes:""});
   const offer=await offers.saveOffer("source",{caseId:item.id,institutionId:institution.id,data});
   const command={kind:"case",id:item.id,ownerId:"source",version:1,targetId:"destination",reason:"Relève du référent"};
   await assert.rejects(reassignFinance("source",command),/réservé/);
   await assert.rejects(reassignFinance("admin",{...command,targetId:"agent"}),/Finance actif/);
   await assert.rejects(reassignFinance("admin",{...command,targetId:"source"}),/autre référent/);
   await db.user.update({where:{id:"third"},data:{active:false}});
   await assert.rejects(reassignFinance("admin",{...command,targetId:"third"}),/Finance actif/);
   const result=await Promise.allSettled([reassignFinance("admin",command),reassignFinance("admin",command)]);
   assert.equal(result.filter(r=>r.status==="fulfilled").length,1);
   await assert.rejects(finance.financeCase("source",item.id),/inaccessible/);
   await assert.rejects(docs.readFinanceDocument("source",doc.id),/inaccessible/);
   assert.equal((await docs.readFinanceDocument("destination",doc.id)).document.status,"ACCEPTED");
   assert.equal((await finance.financeCase("destination",item.id)).version,2);
   await assert.rejects(offers.saveOffer("source",{id:offer.id,version:1,caseId:item.id,institutionId:institution.id,data}),/inaccessible/);
   await offers.saveOffer("destination",{id:offer.id,version:1,caseId:item.id,institutionId:institution.id,data:{...data,amount:"150"}});
   assert.equal(offerSchema.parse((await db.financeOfferRevision.findUniqueOrThrow({where:{offerId_version:{offerId:offer.id,version:1}}})).data).amount,"100");
   // Existing offers can be maintained, but another referent’s directory cannot be used to create new ones.
   await assert.rejects(offers.saveOffer("destination",{caseId:item.id,institutionId:institution.id,data}),/inaccessible/);
   const transfer={kind:"institution",id:institution.id,ownerId:"source",version:1,targetId:"destination",reason:"Relève du répertoire"};
   await reassignFinance("admin",transfer);
   await assert.rejects(reassignFinance("admin",transfer),/changé|existent déjà/);
   await offers.saveOffer("destination",{caseId:item.id,institutionId:institution.id,data});
   assert.equal((await db.financeInstitution.findUniqueOrThrow({where:{id:institution.id}})).ownerId,"destination");
   const duplicate=await offers.saveInstitution("source",{data:{name:"Banque fictive",branch:"Agence",contactName:"",contactRole:"",email:"",phone:"",address:"",notes:""}});
   await assert.rejects(reassignFinance("admin",{...transfer,id:duplicate.id}),/existent déjà/);
   assert.equal((await db.financeInstitution.findUniqueOrThrow({where:{id:duplicate.id}})).ownerId,"source");
   assert.equal(await db.auditEvent.count({where:{objectId:item.id,action:"FINANCE_CASE_REASSIGNED"}}),1);
   assert.equal(await db.auditEvent.count({where:{objectId:institution.id,action:"FINANCE_INSTITUTION_REASSIGNED"}}),1);
  });
  await t.test("Un administrateur suspendu ne peut plus administrer",async()=>{
   await team.updateStaff("admin",{id:"admin2",version:0,role:"ADMIN",active:false,reason:"Accès retiré"});
   await assert.rejects(team.inviteStaff("admin2",{...invitation,email:"new@test.invalid"}),/réservé/);
  });
 } finally {await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
