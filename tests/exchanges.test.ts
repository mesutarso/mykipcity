import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
test("Échanges, notifications et dépôt membre Finance",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-exchanges-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=`${root}/files`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db");const messages=await import("../src/lib/management");const notices=await import("../src/lib/notifications");const finance=await import("../src/lib/member-finance-documents");const documents=await import("../src/lib/finance-documents");const updates=await import("../src/lib/member-finance");
 try{
  for(const [id,role] of [["buyer","ACQUIRER"],["other","ACQUIRER"],["agent","ACQUIRER_AGENT"],["finance","FINANCE_OFFICER"],["other-finance","FINANCE_OFFICER"],["admin","ADMIN"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  for(const id of ["buyer","other"])await db.acquirer.create({data:{id,reference:id,registeredName:id,email:`${id}@test.invalid`,personId:id,userId:id,file:{create:{id:`file-${id}`,declarations:{create:{reference:`PARCEL-${id}`,contractNumber:"TEST",status:"APPROVED"}}}}}});
  const pdf=Buffer.from("%PDF-1.4\nFICTIF");let messageId="";
  await t.test("Messages : objet, parcelle, rejeu et pièces du bon dossier",async()=>{
   const input={fileId:"file-buyer",subject:"Mon contrat",parcelReference:"PARCEL-buyer",body:"Merci de vérifier ma pièce.",clientToken:crypto.randomUUID()};
   messageId=(await messages.sendMessage("buyer",input)).id;
   assert.equal((await messages.sendMessage("buyer",input)).id,messageId);assert.equal(await db.message.count(),1);
   await assert.rejects(messages.sendMessage("buyer",{...input,body:"Autre texte"}),/déjà/);
   await assert.rejects(messages.sendMessage("other",{...input,clientToken:crypto.randomUUID()}),/inaccessible/);
   await assert.rejects(messages.sendMessage("buyer",{...input,clientToken:crypto.randomUUID(),parcelReference:"PARCEL-other"}),/parcelle/);
   await assert.rejects(messages.sendMessage("buyer",{...input,clientToken:crypto.randomUUID(),attachmentId:"other-document"}),/inaccessible/);
   await assert.rejects(messages.conversation("admin","file-buyer"),/inaccessible/);
   assert.equal((await messages.conversationPage("buyer","file-buyer")).messages[0].subject,"Mon contrat");
  });
  await t.test("Notifications : isolation, lecture individuelle et pagination des échanges",async()=>{
   assert.equal((await notices.notifications("other")).length,0);assert.ok((await notices.notifications("agent")).some(n=>n.id===`message:${messageId}`&&!n.read));
   await assert.rejects(notices.markNotifications("other",{ids:[`message:${messageId}`]}),/accessible/);
   await notices.markNotifications("agent",{ids:[`message:${messageId}`]});assert.ok((await notices.notifications("agent")).find(n=>n.id===`message:${messageId}`)?.read);
   assert.equal((await messages.conversationPage("buyer","file-buyer")).messages[0].readByRecipient,true);
   for(let i=0;i<27;i++)await messages.sendMessage("buyer",{fileId:"file-buyer",body:`Message ${i}`});
   assert.equal((await messages.conversationPage("buyer","file-buyer",1)).messages.length,25);assert.equal((await messages.conversationPage("buyer","file-buyer",2)).messages.length,3);
  });
  const item=await db.financeCase.create({data:{ownerId:"finance",acquirerId:"buyer",reference:"FIN-TEST",applicantName:"Nom interne confidentiel",pathway:"HABITAT",request:{secret:"PRIVATE_REQUEST"}}});
  const requirement=await documents.addRequirement("finance",{caseId:item.id,category:"LAND",label:"Copie du contrat"});
  const share=(version:number,expose=true)=>finance.shareFinanceRequirement("finance",{id:requirement.id,version,share:expose,instructions:"Copie lisible de toutes les pages."});
  await t.test("Demande Finance privée jusqu’au partage explicite et au suivi publié",async()=>{
   assert.deepEqual(await finance.memberFinanceRequirements("buyer"),[]);await assert.rejects(share(0),/Publiez/);
   await updates.manageMemberUpdate("finance",{action:"save",caseId:item.id,version:0,data:{title:"Accompagnement",stage:"IN_PROGRESS",message:"Votre dossier est en préparation.",documents:[],appointmentDate:"",appointmentTime:"",appointmentPlace:"",contact:"Équipe Finance"}});
   await updates.manageMemberUpdate("finance",{action:"publish",caseId:item.id,version:1});await share(0);
   await assert.rejects(share(0),/changé/);
   const rows=await finance.memberFinanceRequirements("buyer");assert.equal(rows.length,1);assert.equal(rows[0].canUpload,true);assert.ok(!JSON.stringify(rows).includes("PRIVATE_REQUEST"));assert.ok(!JSON.stringify(rows).includes("confidentiel"));
   assert.deepEqual(await finance.memberFinanceRequirements("other"),[]);
   await assert.rejects(finance.shareFinanceRequirement("other-finance",{id:requirement.id,version:1,share:false}),/inaccessible/);
  });
  let docId="";
  await t.test("Dépôt privé du membre, doublon refusé et contrôle Finance",async()=>{
   await assert.rejects(documents.depositFinanceDocument("other",{requirementId:requirement.id,version:0},"contrat.pdf",pdf),/inaccessible/);
   docId=(await documents.depositFinanceDocument("buyer",{requirementId:requirement.id,version:0},"contrat.pdf",pdf)).id;
   assert.equal((await documents.readFinanceDocument("buyer",docId)).bytes.toString(),pdf.toString());
   await assert.rejects(documents.readFinanceDocument("other",docId),/inaccessible/);
   assert.equal((await finance.memberFinanceRequirements("buyer"))[0].canUpload,false);
   await assert.rejects(documents.depositFinanceDocument("buyer",{requirementId:requirement.id,version:1},"dup.pdf",pdf),/déjà/);
   assert.ok((await notices.notifications("finance")).some(n=>n.id===`finance-document:${docId}`));
   await documents.reviewFinanceDocument("finance",{id:docId,decision:"REJECTED",reason:"Merci de joindre une copie lisible."});
   assert.equal((await finance.memberFinanceRequirements("buyer"))[0].canUpload,true);
   const replacement=await documents.depositFinanceDocument("buyer",{requirementId:requirement.id,version:1},"contrat-v2.pdf",pdf);await documents.reviewFinanceDocument("finance",{id:replacement.id,decision:"ACCEPTED",reason:"Toutes les pages sont présentes."});
   assert.equal((await finance.memberFinanceRequirements("buyer"))[0].documents.length,2);assert.equal((await finance.memberFinanceRequirements("buyer"))[0].canUpload,false);
  });
  await t.test("Retrait, suspension, réaffectation et documents internes restent cloisonnés",async()=>{
   await db.user.update({where:{id:"buyer"},data:{active:false}});await assert.rejects(documents.readFinanceDocument("buyer",docId),/suspendu/);await db.user.update({where:{id:"buyer"},data:{active:true}});
   await db.financeCase.update({where:{id:item.id},data:{acquirerId:"other"}});assert.deepEqual(await finance.memberFinanceRequirements("buyer"),[]);assert.deepEqual(await finance.memberFinanceRequirements("other"),[]);await assert.rejects(documents.readFinanceDocument("other",docId),/inaccessible/);
   await db.financeCase.update({where:{id:item.id},data:{acquirerId:"buyer"}});
   const internal=await documents.addRequirement("finance",{caseId:item.id,category:"OTHER",label:"Note interne"});const privateDoc=await documents.depositFinanceDocument("finance",{requirementId:internal.id,version:0},"interne.pdf",pdf);await assert.rejects(documents.readFinanceDocument("buyer",privateDoc.id),/inaccessible/);
   await share(1,false);assert.deepEqual(await finance.memberFinanceRequirements("buyer"),[]);await assert.rejects(documents.readFinanceDocument("buyer",docId),/inaccessible/);
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
