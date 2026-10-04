import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readdirSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
test("Contact : pièces jointes privées, envoi atomique et sauvegardes",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-message-files-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=`${root}/documents`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db"),{sendMessage,readMessageFile}=await import("../src/lib/management");
 try{
  for(const [id,role] of [["buyer","ACQUIRER"],["other","ACQUIRER"],["agent","ACQUIRER_AGENT"],["admin","ADMIN"],["finance","FINANCE_OFFICER"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  for(const id of ["buyer","other"])await db.acquirer.create({data:{id,reference:id,registeredName:id,email:`${id}@test.invalid`,personId:id,userId:id,file:{create:{id:`file-${id}`,fullName:id,declarations:{create:{reference:"P1",contractNumber:"C1"}}}}}});
  const input={fileId:"file-buyer",subject:"Pièce pour mon dossier",body:"Bonjour, voici la copie demandée.",parcelReference:"P1",clientToken:randomUUID()};
  const upload={name:"copie.pdf",bytes:Buffer.from("%PDF-1.4 COPIE FICTIVE")};let id="";
  await t.test("Fichier du message consultable uniquement dans la conversation autorisée",async()=>{
   id=(await sendMessage("buyer",input,upload)).id;
   const saved=await db.message.findUniqueOrThrow({where:{id}});assert.equal(saved.uploadSize,upload.bytes.length);assert.equal(saved.uploadName,"copie.pdf");assert.equal(saved.attachmentId,null);
   for(const actor of ["buyer","agent"])assert.deepEqual((await readMessageFile(actor,id)).bytes,upload.bytes);
   for(const actor of ["other","admin","finance"])await assert.rejects(readMessageFile(actor,id),{status:404});
   await assert.rejects(sendMessage("other",{...input,clientToken:randomUUID()},upload),{status:404});
   assert.equal(await db.memberDocument.count(),0);assert.equal(await db.document.count(),0);
  });
  await t.test("Rejeu identique accepté, changement de fichier ou retrait du fichier refusé",async()=>{
   const replay=await sendMessage("buyer",input,upload);assert.equal(replay.id,id);
   await assert.rejects(sendMessage("buyer",input,{...upload,bytes:Buffer.from("%PDF-1.4 AUTRE")}),{status:409});
   await assert.rejects(sendMessage("buyer",input,{...upload,name:"autre.pdf"}),{status:409});
   await assert.rejects(sendMessage("buyer",input),{status:409});assert.equal(await db.message.count(),1);assert.equal(readdirSync(`${root}/documents/messages`).length,1);
  });
  await t.test("Concurrence, format, taille et nettoyage des dépôts refusés",async()=>{
   const concurrent={...input,clientToken:randomUUID()};await Promise.allSettled([sendMessage("buyer",concurrent,upload),sendMessage("buyer",concurrent,upload)]);assert.equal(await db.message.count(),2);assert.equal(readdirSync(`${root}/documents/messages`).length,2);
   await assert.rejects(sendMessage("buyer",{...input,clientToken:randomUUID(),parcelReference:"INCONNUE"},upload),/parcelle de ce dossier/);
   await assert.rejects(sendMessage("buyer",{...input,clientToken:randomUUID()},{name:"script.pdf",bytes:Buffer.from("<script>bad</script>")}),/Format non reconnu/);
   await assert.rejects(sendMessage("buyer",{...input,clientToken:randomUUID()},{name:"gros.pdf",bytes:Buffer.alloc(8*1024*1024+1)}),/8 Mo/);
   await assert.rejects(sendMessage("buyer",{...input,clientToken:randomUUID(),attachmentId:"document-existant"},upload),/fichier ou un document/);
   assert.equal(readdirSync(`${root}/documents/messages`).length,2);assert.equal(await db.message.count(),2);
  });
  await t.test("Réponse de l’équipe, suspension et conservation lors d’une sauvegarde",async()=>{
   const answer=await sendMessage("agent",{...input,body:"Voici notre réponse et son document.",clientToken:randomUUID()},upload);await readMessageFile("buyer",answer.id);
   await db.user.update({where:{id:"buyer"},data:{active:false}});await assert.rejects(readMessageFile("buyer",id),{status:403});await assert.rejects(sendMessage("buyer",{...input,clientToken:randomUUID()},upload),{status:403});await db.user.update({where:{id:"buyer"},data:{active:true}});
   const backup=await import("../scripts/backup");const saved=await backup.createBackup(`${root}/db`,`${root}/documents`,`${root}/backup`);assert.equal(saved.documents,3);await backup.restoreBackup(`${root}/backup`,`${root}/restored`);assert.equal(readdirSync(`${root}/restored/documents/messages`).length,3);
  });
  await t.test("L’altération d’une pièce jointe est détectée avant téléchargement",async()=>{
   const stored=await db.message.findUniqueOrThrow({where:{id}});writeFileSync(`${root}/documents/messages/${stored.uploadStorageKey}`,"ALTERED");await assert.rejects(readMessageFile("agent",id),{status:409});
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
