import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";

test("MyKipCity : regroupements et remplacements vérifiés par deux personnes",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-changes-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=`${root}/files`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db"),flow=await import("../src/lib/workflow"),docs=await import("../src/lib/documents"),changes=await import("../src/lib/acquirer-changes"),pubs=await import("../src/lib/publications"),{manageParcelAccess}=await import("../src/lib/parcel-access"),{notifications}=await import("../src/lib/notifications"),{conversation,sendMessage}=await import("../src/lib/management"),{memberFinance}=await import("../src/lib/member-finance");
 try{
  for(const [id,role,personId] of [["agent","ACQUIRER_AGENT","agent"],["reviewer","ACQUIRER_AGENT","reviewer"],["alias","ACQUIRER_AGENT","agent"],["admin","ADMIN","admin"],["finance","FINANCE_OFFICER","finance"]])await db.user.create({data:{id,email:`${id}@test.invalid`,name:id,role,personId}});
  async function buyer(id:string,ref:string,approved=false){
   await db.user.create({data:{id,name:id,email:`${id}@test.invalid`,role:"ACQUIRER",personId:id,emailVerified:true}});
   const parcel=await db.parcel.upsert({where:{reference:ref},update:{},create:{reference:ref,cadastralReference:`CAD-${ref}`,area:100}});
   await db.acquirer.create({data:{id,reference:id.toUpperCase(),registeredName:id,email:`${id}@test.invalid`,personId:id,userId:id,file:{create:{id:`f-${id}`,fullName:id,phone:"123456789",city:"Kinshasa",country:"RDC",declarations:{create:{id:`d-${id}`,reference:ref,contractNumber:`C-${id}`,status:approved?"APPROVED":"PENDING",parcelId:approved?parcel.id:null}}}}}});
   const proof=await docs.depositDocument(id,"preuve.pdf",Buffer.from(`%PDF-1.4 ${id}`),{category:"ACQUISITION",parcelReferences:[ref]});
   await db.acquirerFile.update({where:{id:`f-${id}`},data:{status:approved?"VERIFIED":"SUBMITTED"}});
   return {id,fileId:`f-${id}`,proofId:proof.id,declarationId:`d-${id}`,parcelId:parcel.id};
  }
  const source=await buyer("source","P1",true),target=await buyer("target","P2",true),stranger=await buyer("stranger","P3",true);
  const input={kind:"CONSOLIDATE",sourceFileId:source.fileId,targetFileId:target.fileId,sourceProofId:source.proofId,targetProofId:target.proofId,reason:"Identité concordante vérifiée dans les deux contrats",checked:true};
  const approve=(id:string)=>({id,decision:"APPROVE",reason:"Identité et compte conservé vérifiés indépendamment",checked:true});
  await t.test("Rôles, preuves étrangères et absence d’élargissement avant la décision",async()=>{
   for(const user of ["source","admin","finance"])await assert.rejects(changes.prepareAcquirerChange(user,input),{status:403});
   await assert.rejects(changes.prepareAcquirerChange("agent",{...input,targetProofId:stranger.proofId}),{status:409});
   await assert.rejects(docs.readDocument("target",source.proofId),{status:404});
  });
  let requestId="";
  await t.test("Préparation, indépendance sur la personne et retrait sans effet",async()=>{
   const first=await changes.prepareAcquirerChange("agent",input);
   for(const user of ["agent","alias"])await assert.rejects(changes.decideAcquirerChange(user,approve(first.id)),{status:403});
   await assert.rejects(changes.prepareAcquirerChange("reviewer",input),{status:409});
   await changes.decideAcquirerChange("agent",{...approve(first.id),decision:"CANCEL"});
   assert.equal((await db.user.findUniqueOrThrow({where:{id:"source"}})).active,true);
   requestId=(await changes.prepareAcquirerChange("agent",input)).id;
  });
  await t.test("Une pièce remplacée ou un dossier modifié impose un nouvel examen",async()=>{
   await db.acquirerFile.update({where:{id:source.fileId},data:{version:{increment:1}}});
   await assert.rejects(changes.decideAcquirerChange("reviewer",approve(requestId)),{status:409});
   assert.equal((await db.acquirer.findUniqueOrThrow({where:{id:"source"}})).userId,"source");
   await changes.decideAcquirerChange("reviewer",{...approve(requestId),decision:"REJECT"});
  });
  const article=await db.memberPublication.create({data:{title:"Suivi personnel source",body:"Données privées du dossier source",audience:"ACQUIRER",targetId:"source",status:"PUBLISHED",publishedAt:new Date(),authorId:"agent",authorPersonId:"agent"}});
  await db.financeCase.create({data:{id:"case-source",reference:"FIN-SOURCE",ownerId:"finance",applicantName:"Source",pathway:"HABITAT",acquirerId:"source",request:{},memberUpdate:{create:{visible:true,audienceId:"source",draft:{},published:{title:"Suivi source",stage:"IN_PROGRESS",message:"Étude en cours",documents:[],appointmentDate:"",appointmentTime:"",appointmentPlace:"",contact:"Équipe"},publishedAt:new Date()}}}});
  await sendMessage("source",{fileId:source.fileId,body:"Message historique"});
  const financeDocs=await import("../src/lib/finance-documents"),memberDocs=await import("../src/lib/member-finance-documents");
  const requirement=await financeDocs.addRequirement("finance",{caseId:"case-source",category:"IDENTITY",label:"Identité du membre"});
  await memberDocs.shareFinanceRequirement("finance",{id:requirement.id,version:0,share:true});
  const memberDocument=await financeDocs.depositFinanceDocument("source",{requirementId:requirement.id,version:0},"identite.pdf",Buffer.from("%PDF-1.4 identité fictive"));
  const internalRequirement=await financeDocs.addRequirement("finance",{caseId:"case-source",category:"OTHER",label:"Note interne"});
  const internalDocument=await financeDocs.depositFinanceDocument("finance",{requirementId:internalRequirement.id,version:0},"interne.pdf",Buffer.from("%PDF-1.4 note interne"));
  await t.test("Approbation concurrente : une seule opération, dossiers et archives conservés",async()=>{
   for(const userId of ["source","target"])await db.session.create({data:{id:`s-${userId}`,userId,token:`token-${userId}`,expiresAt:new Date("2099-01-01")}});
   requestId=(await changes.prepareAcquirerChange("agent",input)).id;
   const result=await Promise.allSettled([changes.decideAcquirerChange("reviewer",approve(requestId)),changes.decideAcquirerChange("reviewer",approve(requestId))]);
   assert.equal(result.filter(r=>r.status==="fulfilled").length,1);
   assert.equal((await db.user.findUniqueOrThrow({where:{id:"source"}})).active,false);
   assert.equal(await db.session.count({where:{userId:{in:["source","target"]}}}),0);
   assert.equal(await db.acquirerFile.count({where:{acquirer:{userId:"target"}}}),2);
   assert.equal((await db.document.findUniqueOrThrow({where:{id:source.proofId}})).fileId,source.fileId);
   assert.equal((await db.message.findFirstOrThrow({where:{fileId:source.fileId}})).authorId,"source");
   assert.equal(await db.auditEvent.count({where:{action:"ACCOUNT_CONSOLIDATED"}}),2);
  });
  await t.test("Compte conservé : deux dossiers, articles et suivi Finance ; compte ancien et tiers refusés",async()=>{
   await docs.readDocument("target",source.proofId);await docs.readDocument("target",target.proofId);
   await assert.rejects(docs.readDocument("source",source.proofId),{status:403});
   await assert.rejects(docs.readDocument("stranger",source.proofId),{status:404});
   await conversation("target",source.fileId);await assert.rejects(conversation("stranger",source.fileId),{status:404});
   assert.equal((await pubs.memberPublication("target",article.id)).id,article.id);
   assert.equal((await memberFinance("target")).length,1);
   assert.ok((await notifications("target")).some(n=>n.title==="Vos dossiers ont été regroupés"));
   await changes.selectAcquirerFile("target",{fileId:source.fileId});assert.equal((await flow.ownFile("target")).id,source.fileId);
   await assert.rejects(changes.selectAcquirerFile("stranger",{fileId:source.fileId}),{status:404});
  });
  await t.test("Formulaires multi-dossiers : identifiant explicite, aucune écriture sur un autre dossier",async()=>{
   const {updateProfile}=await import("../src/lib/profile");
   const a=await flow.ownFile("target",source.fileId),b=await flow.ownFile("target",target.fileId);
   await assert.rejects(updateProfile("target",{version:a.version,phone:"123456789",city:"Lubumbashi",country:"RDC"}),{status:409});
   await updateProfile("target",{fileId:target.fileId,version:b.version,phone:"123456789",city:"Lubumbashi",country:"RDC"});
   assert.equal((await flow.ownFile("target",source.fileId)).city,a.city);
   assert.equal((await flow.ownFile("target",target.fileId)).city,"Lubumbashi");
   await assert.rejects(flow.submitDossier("target",a.version),{status:409});
  });
  await t.test("Pièces Finance historiques conservées sans exposer les pièces internes",async()=>{
   const rows=await memberDocs.memberFinanceRequirements("target");
   assert.ok(rows.some(r=>r.documents.some(d=>d.id===memberDocument.id)));
   await financeDocs.readFinanceDocument("target",memberDocument.id);
   await assert.rejects(financeDocs.readFinanceDocument("target",internalDocument.id),{status:404});
   await assert.rejects(financeDocs.readFinanceDocument("stranger",memberDocument.id),{status:404});
   await assert.rejects(financeDocs.readFinanceDocument("source",memberDocument.id),{status:403});
  });
  await t.test("Changement d’adresse du compte conservé sans collision entre les fiches",async()=>{
   const {confirmEmailChange}=await import("../src/lib/email-change");
   const user=await db.user.findUniqueOrThrow({where:{id:"target"}}),oldToken="a".repeat(64),newToken="b".repeat(64);
   await db.emailChange.create({data:{userId:user.id,oldEmail:user.email,newEmail:"nouvelle@test.invalid",oldTokenHash:flow.tokenHash(oldToken),newTokenHash:flow.tokenHash(newToken),accessVersion:user.accessVersion,expiresAt:new Date(Date.now()+3600000)}});
   assert.equal((await confirmEmailChange({token:oldToken})).complete,false);
   assert.equal((await confirmEmailChange({token:newToken})).complete,true);
   assert.equal((await db.acquirer.findUniqueOrThrow({where:{id:"target"}})).email,"nouvelle@test.invalid");
   assert.equal((await db.acquirer.findUniqueOrThrow({where:{id:"source"}})).email,"source@test.invalid");
   assert.equal(await db.acquirer.count({where:{userId:"target"}}),2);
  });
  const old=await buyer("old","T1",true),next=await buyer("next","T1");
  const transfer={kind:"TRANSFER",sourceFileId:old.fileId,targetFileId:next.fileId,sourceProofId:old.proofId,targetProofId:next.proofId,sourceDeclarationId:old.declarationId,targetDeclarationId:next.declarationId,reason:"Remplacement demandé sur les nouvelles pièces contractuelles",checked:true};
  const info=await db.memberPublication.create({data:{title:"Parcelle T1",body:"Suivi du terrain T1",audience:"PARCEL",targetId:old.parcelId,status:"PUBLISHED",publishedAt:new Date(),authorId:"agent",authorPersonId:"agent"}});
  await t.test("Remplacement : retrait et nouveau rattachement atomiques, aucun document privé transféré",async()=>{
   const r=await changes.prepareAcquirerChange("agent",transfer);
   await assert.rejects(pubs.memberPublication("next",info.id),{status:404});await pubs.memberPublication("old",info.id);
   await changes.decideAcquirerChange("reviewer",approve(r.id));
   await pubs.memberPublication("next",info.id);await assert.rejects(pubs.memberPublication("old",info.id),{status:404});
   await docs.readDocument("old",old.proofId);await assert.rejects(docs.readDocument("next",old.proofId),{status:404});
   assert.equal((await flow.ownFile("old")).declarations[0].status,"ACCESS_REVOKED");
   assert.equal((await flow.ownFile("next")).status,"VERIFIED");
   const oldFile=await flow.ownFile("old");await assert.rejects(manageParcelAccess("agent",{id:old.declarationId,version:oldFile.version,action:"RENEW",reason:"Tentative de restauration de l’ancien titulaire",access:{quality:"HOLDER",proofId:old.proofId,principal:"",expiresOn:"",checked:true,sharedChecked:true}}),{status:409});
  });
  await t.test("Le second agent refuse une preuve altérée sans changer les droits",async()=>{
   const a=await buyer("old2","T2",true),b=await buyer("next2","T2");
   const r=await changes.prepareAcquirerChange("agent",{...transfer,sourceFileId:a.fileId,targetFileId:b.fileId,sourceProofId:a.proofId,targetProofId:b.proofId,sourceDeclarationId:a.declarationId,targetDeclarationId:b.declarationId});
   const p=await db.document.findUniqueOrThrow({where:{id:b.proofId}});writeFileSync(join(root,"files",p.storageKey),"altéré");
   await assert.rejects(changes.decideAcquirerChange("reviewer",approve(r.id)),{status:409});
   assert.equal((await flow.ownFile("old2")).declarations[0].status,"APPROVED");
   assert.equal((await flow.ownFile("next2")).declarations[0].status,"PENDING");
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
