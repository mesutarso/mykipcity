import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {contractGroups} from "../src/lib/contract-groups";
test("Contrats : pages, versions, preuves et reprise de dépôt",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-contracts-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=`${root}/files`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db"),docs=await import("../src/lib/documents"),workflow=await import("../src/lib/workflow"),{documentDetails,identityDetails,parcelDetails}=await import("../src/lib/dossier-model");
 try{
  for(const [id,role] of [["buyer","ACQUIRER"],["other","ACQUIRER"],["agent","ACQUIRER_AGENT"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  for(const id of ["buyer","other"])await db.acquirer.create({data:{id,reference:id,registeredName:id,email:`${id}@test.invalid`,personId:id,userId:id,file:{create:{id:`file-${id}`,fullName:id,phone:"123456789",city:"Kinshasa",country:"RDC",details:identityDetails.parse({lastName:id,holderName:id,address:"Rue test"})}}}});
  for(const reference of ["A01","B02"])await db.parcelDeclaration.create({data:{fileId:"file-buyer",reference,contractNumber:"C01",details:parcelDetails.parse({holders:"buyer"})}});
  const upload=(name:string)=>({name,buffer:Buffer.from(`%PDF-1.4 ${name}`)});
  const input={version:(await workflow.ownFile("buyer")).version,token:randomUUID()};
  let firstId="",currentId="";
  await t.test("Plusieurs pages ordonnées, classement commun et reprise sans doublon",async()=>{
   await docs.depositContract("buyer",input,[upload("page2.pdf"),upload("page1.pdf")]);
   const file=await workflow.ownFile("buyer");const group=contractGroups(file.documents)[0];assert.equal(group.versions[0].pages.length,2);assert.equal(group.versions[0].pages[0].originalName,"page2.pdf");firstId=group.versions[0].pages[0].id;
   await docs.depositContract("buyer",input,[upload("page2.pdf"),upload("page1.pdf")]);assert.equal(await db.document.count(),2);
   await assert.rejects(docs.depositContract("buyer",input,[upload("different.pdf")]),{status:409});
   await assert.rejects(docs.depositContract("other",input,[upload("page2.pdf"),upload("page1.pdf")]),{status:409});
   const details=documentDetails.parse({category:"LEASE",parcelReferences:["A01","B02"],reference:"C01",issuedOn:"",issuer:"",effectiveOn:"",duration:"",observation:""});
   await docs.classifyDocument("buyer",{id:firstId,version:file.version,details});const pages=await db.document.findMany();assert.ok(pages.every(p=>JSON.stringify(p.details)===JSON.stringify(pages[0].details)));
  });
  await t.test("Remplacement concurrent, ancienne copie privée et nettoyage des échecs",async()=>{
   const file=await workflow.ownFile("buyer");const results=await Promise.allSettled([1,2].map(()=>docs.depositContract("buyer",{version:file.version,replaceId:firstId,token:randomUUID()},[upload("nouveau.pdf")])));assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
   const all=await db.document.findMany();assert.equal(all.length,3);assert.equal(readdirSync(`${root}/files`).length,3);assert.equal(all.filter(d=>d.isCurrent).length,1);currentId=all.find(d=>d.isCurrent)!.id;
   assert.equal(all.find(d=>d.id===currentId)!.revision,2);assert.equal((await docs.readDocument("buyer",firstId)).bytes.toString(),"%PDF-1.4 page2.pdf");await docs.readDocument("agent",firstId);await assert.rejects(docs.readDocument("other",firstId),{status:404});
   await assert.rejects(docs.classifyDocument("buyer",{id:firstId,version:file.version+1,details:all[0].details}),{status:409});
   await assert.rejects(docs.depositContract("other",{version:0,replaceId:currentId,token:randomUUID()},[upload("x.pdf")]),{status:409});assert.equal(readdirSync(`${root}/files`).length,3);
   await assert.rejects(docs.depositContract("buyer",{version:file.version+1,token:randomUUID()},[upload("ok.pdf"),{name:"bad.txt",buffer:Buffer.from("bad")} ]));assert.equal(readdirSync(`${root}/files`).length,3);
  });
  await t.test("Les anciennes versions ne justifient plus la transmission",async()=>{
   const file=await workflow.ownFile("buyer");const prior=await db.document.findUniqueOrThrow({where:{id:firstId}});const detail=documentDetails.parse(prior.details);
   await docs.classifyDocument("buyer",{id:currentId,version:file.version,details:{...detail,category:"PLAN"}});
   await assert.rejects(workflow.submitDossier("buyer",file.version+1),/copie contractuelle/);
   await docs.classifyDocument("buyer",{id:currentId,version:file.version+1,details:detail});await workflow.submitDossier("buyer",file.version+2);
   await assert.rejects(docs.depositContract("buyer",{version:file.version+3,replaceId:currentId,token:randomUUID()},[upload("locked.pdf")]),{status:409});
  });
  await t.test("Contrat d’une parcelle examinée protégé et anciennes versions sauvegardées",async()=>{
   await db.acquirerFile.update({where:{id:"file-buyer"},data:{status:"NEEDS_INFO"}});await db.parcelDeclaration.updateMany({where:{fileId:"file-buyer",reference:"A01"},data:{status:"APPROVED"}});
   const file=await workflow.ownFile("buyer");await assert.rejects(docs.depositContract("buyer",{version:file.version,replaceId:currentId,token:randomUUID()},[upload("blocked.pdf")]),/déjà examinée/);
   const backup=await import("../scripts/backup");const result=await backup.createBackup(`${root}/db`,`${root}/files`,`${root}/backup`);assert.equal(result.documents,3);await backup.restoreBackup(`${root}/backup`,`${root}/restore`);
   assert.equal(readdirSync(`${root}/restore/documents`).length,3);
  });

  await t.test("Anciens dépôts remplaçables, limites documentaires et compte suspendu",async()=>{
   const legacy=await docs.depositDocument("other","ancien.pdf",Buffer.from("%PDF-1.4 ANCIEN"));
   const file=await workflow.ownFile("other");await docs.depositContract("other",{version:file.version,replaceId:legacy.id,token:randomUUID()},[upload("correction.pdf")]);
   const pages=await db.document.findMany({where:{fileId:"file-other"}});assert.equal(contractGroups(pages).length,1);assert.equal(contractGroups(pages)[0].versions.length,2);
   const current=await workflow.ownFile("other");await assert.rejects(docs.depositContract("other",{version:current.version,token:randomUUID()},Array.from({length:11},(_,i)=>upload(`${i}.pdf`))),/1 à 10/);
   const twenty=Buffer.alloc(20*1024*1024);twenty.write("%PDF-");assert.equal(docs.detectFile(twenty,docs.MAX_CONTRACT_FILE_SIZE),"application/pdf");assert.throws(()=>docs.detectFile(Buffer.alloc(20*1024*1024+1),docs.MAX_CONTRACT_FILE_SIZE),/20 Mo/);
   await db.user.update({where:{id:"other"},data:{active:false}});await assert.rejects(docs.depositContract("other",{version:current.version,token:randomUUID()},[upload("suspendu.pdf")]),{status:403});
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
