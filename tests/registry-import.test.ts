import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {parseRegistryCsv,type ImportRow} from "../src/lib/registry-import-model";
test("CSV registre : UTF-8, champs cités, colonnes et limites",()=>{
 assert.deepEqual(parseRegistryCsv('\uFEFFreference;nom;email\r\nA1;"Nom; composé";a@test.invalid\r\n',"ACQUIRERS"),[["A1","Nom; composé","a@test.invalid"]]);
 assert.deepEqual(parseRegistryCsv('reference,nom,email\nA1,"Nom ""cité""\nSuite",a@test.invalid',"ACQUIRERS"),[["A1",'Nom "cité"\nSuite',"a@test.invalid"]]);
 for(const csv of ['reference;nom;email\nA1;"sans fin;a@test.invalid','reference;nom;email\nA1;"nom"x;a@test.invalid','ref;nom;email\nA1;Nom;a@test.invalid','reference;nom;email\n','reference;nom;email\nA1;\uFFFD;a@test.invalid'])assert.throws(()=>parseRegistryCsv(csv,"ACQUIRERS"));
 assert.throws(()=>parseRegistryCsv('reference;nom;email\n'+Array.from({length:501},(_,i)=>`A${i};Nom;n${i}@test.invalid`).join('\n'),"ACQUIRERS"),/500/);
});
test("Import registre : aperçu, conflits, confirmation et traçabilité",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-import-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db"),service=await import("../src/lib/registry-import");
 try{
  for(const [id,role] of [["agent","ACQUIRER_AGENT"],["other","ACQUIRER_AGENT"],["buyer","ACQUIRER"],["admin","ADMIN"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  const preview=(csv:string,kind:"ACQUIRERS"|"PARCELS"="ACQUIRERS",user="agent")=>service.previewRegistryImport(user,{csv,kind,filename:"registre.csv"});
  const confirm=(id:string,user="agent",warningsAccepted=false)=>service.confirmRegistryImport(user,{id,confirmed:true,warningsAccepted});
  const report=async(id:string)=>(await db.registryImport.findUniqueOrThrow({where:{id}})).report as ImportRow[];
  await t.test("L’aperçu n’inscrit personne et reste réservé à son auteur habilité",async()=>{
   const csv="reference;nom;email\nA1;Nom Test;test@example.invalid";
   for(const actor of ["buyer","admin"])await assert.rejects(preview(csv,"ACQUIRERS",actor),{status:403});
   const batch=await preview(csv);assert.equal(await db.acquirer.count(),0);assert.equal(await db.user.count(),4);assert.equal((await report(batch.id))[0].state,"CREATE");
   await assert.rejects(confirm(batch.id,"other"),{status:404});
   await db.user.update({where:{id:"agent"},data:{active:false}});await assert.rejects(confirm(batch.id),{status:403});await db.user.update({where:{id:"agent"},data:{active:true}});
   await assert.rejects(service.confirmRegistryImport("agent",{id:batch.id,confirmed:false,warningsAccepted:false}));
   await confirm(batch.id);await confirm(batch.id);assert.equal(await db.acquirer.count(),1);assert.equal(await db.user.count(),4);assert.equal(await db.invitation.count(),0);assert.equal(await db.parcelDeclaration.count(),0);
   assert.equal(await db.auditEvent.count({where:{action:"REGISTRY_IMPORT_CONFIRMED",objectId:batch.id}}),1);
  });
  await t.test("Doublons de référence ou e-mail, comptes existants et aucune écriture partielle",async()=>{
   const duplicate=await preview("reference;nom;email\nA2;Personne;a2@test.invalid\na2;Autre;a3@test.invalid\nA4;Nouveau;a4@test.invalid");
   assert.deepEqual((await report(duplicate.id)).map(r=>r.state),["ERROR","ERROR","CREATE"]);await assert.rejects(confirm(duplicate.id),{status:409});assert.equal(await db.acquirer.count(),1);
   const emails=await preview("reference;nom;email\nA2;Personne;x@test.invalid\nA3;Autre;X@test.invalid");assert.ok((await report(emails.id)).every(r=>r.state==="ERROR"));
   const account=await preview("reference;nom;email\nA5;Personne;buyer@test.invalid");assert.equal((await report(account.id))[0].state,"ERROR");
   const changed=await preview("reference;nom;email\nA1;Nom changé;test@example.invalid");await assert.rejects(confirm(changed.id),{status:409});assert.equal((await db.acquirer.findUniqueOrThrow({where:{reference:"A1"}})).registeredName,"Nom Test");
  });
  await t.test("Fiches identiques conservées, homonymes explicitement examinés",async()=>{
   const batch=await preview("reference;nom;email\nA1;Nom Test;test@example.invalid\nA2;Nôm Test;nouveau@test.invalid");
   const rows=await report(batch.id);assert.equal(rows[0].state,"EXISTS");assert.equal(rows[1].warnings.length,1);await assert.rejects(confirm(batch.id),/noms similaires/);
   await confirm(batch.id,"agent",true);assert.equal(await db.acquirer.count(),2);
   const imported=await db.registryImport.findUniqueOrThrow({where:{id:batch.id}});assert.equal((imported.result as {unchanged:number}).unchanged,1);
  });
  await t.test("Registre modifié depuis l’aperçu et aperçu expiré bloqués",async()=>{
   const batch=await preview("reference;superficie;reference_cadastrale\nP1;700;PC1\nP2;800;PC2","PARCELS");
   await db.parcel.create({data:{reference:"P1",area:700,cadastralReference:"PC1"}});await assert.rejects(confirm(batch.id),/registre a changé/);assert.equal(await db.parcel.count(),1);
   const expired=await preview("reference;superficie;reference_cadastrale\nP2;800;PC2","PARCELS");await db.registryImport.update({where:{id:expired.id},data:{expiresAt:new Date("2000-01-01")}});await assert.rejects(confirm(expired.id),/expiré/);
   const conflict=await preview("reference;superficie;reference_cadastrale\nP3;900;pc1","PARCELS");assert.equal((await report(conflict.id))[0].state,"ERROR");
   const invalid=await preview("reference;superficie;reference_cadastrale\nP3;12.5;PC3","PARCELS");assert.equal((await report(invalid.id))[0].state,"ERROR");
  });
  await t.test("Deux confirmations concurrentes ne créent qu’une fois les parcelles",async()=>{
   const batch=await preview("reference;superficie;reference_cadastrale\nP2;800;PC2\nP3;900;PC3","PARCELS");
   const results=await Promise.allSettled([confirm(batch.id),confirm(batch.id)]);assert.ok(results.some(r=>r.status==="fulfilled"));assert.equal(await db.parcel.count(),3);
   assert.equal(await db.auditEvent.count({where:{action:"REGISTRY_IMPORT_CONFIRMED",objectId:batch.id}}),1);assert.equal(await db.auditEvent.count({where:{action:"PARCEL_REGISTERED"}}),2);
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
