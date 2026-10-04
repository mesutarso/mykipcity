import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync,readdirSync,writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
test("Documents membres : dossier privé, versions, contrôles et isolation",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-member-docs-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=`${root}/uploads`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db");const svc=await import("../src/lib/member-documents");
 try{
  for(const [id,role] of [["agent","ACQUIRER_AGENT"],["buyer","ACQUIRER"],["other","ACQUIRER"],["finance","FINANCE_OFFICER"],["admin","ADMIN"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  for(const id of ["buyer","other"])await db.acquirer.create({data:{id,reference:id,registeredName:id,email:`${id}@test.invalid`,personId:id,userId:id,file:{create:{id:`file-${id}`,status:"VERIFIED",declarations:{create:{reference:`PARCEL-${id}`,status:"APPROVED",contractNumber:"TEST"}}}}}});
  const input={fileId:"file-buyer",title:"Plan de votre parcelle",category:"PLAN",parcelReferences:["PARCEL-buyer"],direction:"REQUESTED",instructions:"Déposez un plan lisible."};
  const pdf=Buffer.from("%PDF-1.4\nFichier fictif\n%%EOF");let id="",first="";
  const upload=(version:number,user="buyer",bytes=pdf)=>svc.uploadMemberDocument(user,{documentId:id,version},"../plan.pdf",bytes);
  const review=(version:number,decision="NEEDS_INFO",user="agent")=>svc.reviewMemberDocument(user,{documentId:id,version,decision,reason:"Merci de fournir une copie complète."});
  await t.test("Demande réservée à l’équipe et références du bon dossier",async()=>{
   await assert.rejects(svc.createMemberDocument("buyer",input),/réservée/);
   await assert.rejects(svc.createMemberDocument("finance",input),/inaccessible/);
   await assert.rejects(svc.createMemberDocument("agent",{...input,parcelReferences:["PARCEL-other"]}),/parcelle/);
   ({id}=await svc.createMemberDocument("agent",input));
   assert.equal((await svc.memberDocumentList("buyer","file-buyer")).items.length,1);
   await assert.rejects(svc.memberDocumentList("other","file-buyer"),/inaccessible/);
  });
  await t.test("Fichier sur disque privé, autres comptes et mauvais formats refusés",async()=>{
   await assert.rejects(upload(0,"agent"),/réservé/);await assert.rejects(upload(0,"other"),/inaccessible/);
   await assert.rejects(upload(0,"buyer",Buffer.from("<script>test</script>")),/Format/);
   await assert.rejects(upload(0,"buyer",Buffer.alloc(8*1024*1024+1)),/8 Mo/);
   first=(await upload(0)).id;
   const doc=await db.memberDocumentVersion.findUniqueOrThrow({where:{id:first}});
   const dir=join(root,"uploads/mykipcity/file-buyer",id);assert.equal(readdirSync(dir).length,1);assert.equal(doc.originalName,".._plan.pdf");
   assert.deepEqual((await svc.readMemberDocument("buyer",first)).bytes,pdf);assert.deepEqual((await svc.readMemberDocument("agent",first)).bytes,pdf);
   for(const actor of ["other","finance","admin"])await assert.rejects(svc.readMemberDocument(actor,first),/inaccessible/);
   await db.user.update({where:{id:"buyer"},data:{active:false}});await assert.rejects(svc.readMemberDocument("buyer",first),/suspendu/);await db.user.update({where:{id:"buyer"},data:{active:true}});
  });
  await t.test("Correction, concurrence, anciennes versions et contrôle périmé",async()=>{
   await assert.rejects(review(1,"ACCEPTED","buyer"),/réservée/);
   await review(1); // version 2
   const results=await Promise.allSettled([upload(2),upload(2)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
   assert.equal(readdirSync(join(root,"uploads/mykipcity/file-buyer",id)).length,2);
   await assert.rejects(review(2),/changé/);
   await review(3,"ACCEPTED");await assert.rejects(upload(4),/acceptée/);
   assert.deepEqual((await svc.readMemberDocument("buyer",first)).bytes,pdf);
   await review(4);await upload(5);
   const rows=(await svc.memberDocumentList("buyer","file-buyer")).items[0];assert.equal(rows.versions.length,3);assert.equal(rows.versions[0].revision,3);assert.equal(rows.versions[0].status,"PENDING");
   assert.ok(!JSON.stringify(rows).includes("storageKey"));assert.ok(!JSON.stringify(rows).includes("sha256"));
  });
  await t.test("Pièce remise par l’équipe : pas de brouillon vide exposé, pas d’écriture client",async()=>{
   const received=await svc.createMemberDocument("agent",{...input,title:"Attestation fictive",direction:"RECEIVED"});
   assert.ok(!(await svc.memberDocumentList("buyer","file-buyer")).items.some(r=>r.id===received.id));
   await assert.rejects(svc.uploadMemberDocument("buyer",{documentId:received.id,version:0},"test.pdf",pdf),/réservé/);
   const doc=await svc.uploadMemberDocument("agent",{documentId:received.id,version:0},"attestation.pdf",pdf);
   assert.equal((await svc.readMemberDocument("buyer",doc.id)).document.status,"DELIVERED");
   assert.ok((await svc.memberDocumentList("buyer","file-buyer")).items.some(r=>r.id===received.id));
   await assert.rejects(svc.reviewMemberDocument("agent",{documentId:received.id,version:1,decision:"ACCEPTED",reason:"Fichier contrôlé."}),/examiner/);
  });
  await t.test("Intégrité et chemin du stockage",async()=>{
   const doc=await db.memberDocumentVersion.findUniqueOrThrow({where:{id:first}});writeFileSync(join(root,"uploads/mykipcity/file-buyer",id,doc.storageKey),"altéré");await assert.rejects(svc.readMemberDocument("buyer",first),/vérifié/);
   const slot=await svc.createMemberDocument("agent",input);const previous=process.env.DOCUMENTS_DIR;process.env.DOCUMENTS_DIR="./public/uploads";
   try{await assert.rejects(svc.uploadMemberDocument("buyer",{documentId:slot.id,version:0},"x.pdf",pdf),/hors du dossier public/);}finally{process.env.DOCUMENTS_DIR=previous;}
   assert.equal(await db.memberDocumentVersion.count({where:{documentId:slot.id}}),0);
  });
  await t.test("Annulation et retrait conservent les preuves sans laisser les accès ouverts",async()=>{
   const requested=await svc.createMemberDocument("agent",input);
   await assert.rejects(svc.closeMemberDocument("buyer",{id:requested.id,version:0,reason:"Annulation par le client"}),/réservée/);
   await svc.closeMemberDocument("agent",{id:requested.id,version:0,reason:"Cette pièce n’est plus nécessaire."});
   await assert.rejects(svc.uploadMemberDocument("buyer",{documentId:requested.id,version:1},"test.pdf",pdf),/annulée/);
   await assert.rejects(svc.closeMemberDocument("agent",{id:requested.id,version:0,reason:"Deuxième annulation"}),/changé/);
   const received=await svc.createMemberDocument("agent",{...input,direction:"RECEIVED"});const doc=await svc.uploadMemberDocument("agent",{documentId:received.id,version:0},"remis.pdf",pdf);
   await svc.closeMemberDocument("agent",{id:received.id,version:1,reason:"Le document doit être corrigé."});
   await assert.rejects(svc.readMemberDocument("buyer",doc.id),/retiré/);assert.equal((await svc.readMemberDocument("agent",doc.id)).bytes.toString(),pdf.toString());
   assert.ok(!(await svc.memberDocumentList("buyer","file-buyer")).items.some(i=>i.id===received.id));assert.equal(await db.memberDocumentVersion.count({where:{documentId:received.id}}),1);
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
