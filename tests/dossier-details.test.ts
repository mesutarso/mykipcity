import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import Database from "better-sqlite3";
test("Dossier détaillé, pièces multi-parcelles et restauration",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-dossier-details-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=`${root}/files`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db");const workflow=await import("../src/lib/workflow");const docs=await import("../src/lib/documents");const model=await import("../src/lib/dossier-model");const backup=await import("../scripts/backup");
 try{
  for(const [id,role] of [["buyer","ACQUIRER"],["other","ACQUIRER"],["agent","ACQUIRER_AGENT"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  await db.acquirer.create({data:{id:"buyer",reference:"buyer",registeredName:"Identité au registre",email:"buyer@test.invalid",personId:"buyer",userId:"buyer",file:{create:{id:"file-buyer",fullName:"Nom initial"}}}});
  for(const reference of ["A01","B02"])await db.parcel.create({data:{reference,area:700,cadastralReference:`PC-${reference}`}});
  const identity=model.identityDetails.parse({lastName:"Nom",holderName:"Titulaire du contrat",quality:"REPRESENTATIVE",address:"Adresse actuelle",observation:"Nom à rapprocher."});
  const parcels=["A01","B02"].map(reference=>({reference,contractNumber:"BAIL-TEST",details:model.parcelDetails.parse({holders:"Titulaire du contrat",quality:"REPRESENTATIVE"})}));
  const save=async(version:number,parts=parcels)=>workflow.saveDossier("buyer",{version,fullName:"Nom",phone:"+243 000 000 001",city:"Ville",country:"RDC",details:identity,parcels:parts});
  let id="";
  await t.test("Les déclarations détaillées ne modifient pas le registre",async()=>{
   await save(0);const file=await workflow.ownFile("buyer");assert.deepEqual(file.details,identity);assert.equal(file.acquirer.registeredName,"Identité au registre");assert.equal(file.declarations[0].status,"PENDING");
   await assert.rejects(workflow.submitDossier("buyer",1),/contrat/);
   const deposited=await docs.depositDocument("buyer","plan.pdf",Buffer.from("%PDF-1.4\nEXEMPLE"));id=deposited.id;
   await assert.rejects(workflow.submitDossier("buyer",2),/copie contractuelle/);
   await assert.rejects(docs.classifyDocument("other",{id,version:2,details:{category:"LEASE",parcelReferences:["A01"]}}),/inaccessible/);
   await docs.classifyDocument("buyer",{id,version:2,details:{category:"PLAN",parcelReferences:["A01","B02"]}});
   await assert.rejects(workflow.submitDossier("buyer",3),/copie contractuelle/);
  });
  await t.test("Un contrat commun est lié à deux parcelles sans nouvelle copie",async()=>{
   await assert.rejects(docs.classifyDocument("buyer",{id,version:3,details:{category:"LEASE",parcelReferences:["AUTRE"]}}),/parcelles/);
   await docs.classifyDocument("buyer",{id,version:3,details:{category:"LEASE",parcelReferences:["A01","B02"],reference:"BAIL-TEST",issuedOn:"2000-01-01",duration:"Durée à examiner"}});
   await assert.rejects(docs.classifyDocument("buyer",{id,version:3,details:{category:"LEASE",parcelReferences:["A01"]}}),/changé/);
   assert.equal(await db.document.count(),1);await workflow.submitDossier("buyer",4);const file=await workflow.ownFile("buyer");assert.equal(file.status,"SUBMITTED");assert.equal(file.declarations.filter(d=>d.status==="APPROVED").length,0);
   await assert.rejects(docs.classifyDocument("buyer",{id,version:5,details:{category:"PLAN",parcelReferences:["A01"]}}),/examen/);
  });
  await t.test("Un contrat manquant permet la transmission mais pas la validation",async()=>{
   const file=await workflow.ownFile("buyer");await workflow.reviewDeclaration("agent",{declarationId:file.declarations[0].id,version:file.version,decision:"NEEDS_INFO",reason:"Veuillez vérifier les références.",checkedDocuments:true});
   const fresh=await workflow.ownFile("buyer");await docs.classifyDocument("buyer",{id,version:fresh.version,details:{category:"PLAN",parcelReferences:["A01","B02"]}});
   const version=(await workflow.ownFile("buyer")).version;await save(version,parcels.map(p=>({...p,details:{...p.details,missingContract:true}})));
   await workflow.submitDossier("buyer",version+1);const submitted=await workflow.ownFile("buyer");await assert.rejects(workflow.reviewDeclaration("agent",{declarationId:submitted.declarations[0].id,version:submitted.version,decision:"APPROVED",reason:"Tentative sans preuve contractuelle.",checkedDocuments:true}),/copie contractuelle/);
  });
  await t.test("Sauvegarde complète et restauration indépendante, altération détectée",async()=>{
   const saved=await backup.createBackup(`${root}/db`,`${root}/files`,`${root}/backup`);assert.equal(saved.documents,1);
   await backup.restoreBackup(`${root}/backup`,`${root}/restored`);const restored=new Database(`${root}/restored/database.sqlite`,{readonly:true});try{assert.equal((restored.prepare("SELECT count(*) as n FROM Document").get() as {n:number}).n,1);}finally{restored.close();}
   const doc=await db.document.findUniqueOrThrow({where:{id}});assert.deepEqual(readFileSync(`${root}/restored/documents/${doc.storageKey}`),readFileSync(`${root}/files/${doc.storageKey}`));
   await assert.rejects(backup.restoreBackup(`${root}/backup`,`${root}/restored`),/EEXIST/);
   writeFileSync(`${root}/backup/documents/${doc.storageKey}`,"ALTERED");await assert.rejects(backup.verifyBackup(`${root}/backup`),/altérée/);
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
