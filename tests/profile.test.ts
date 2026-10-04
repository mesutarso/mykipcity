import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
test("Profil : coordonnées personnelles et conservation des décisions",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-profile-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db");const {updateProfile}=await import("../src/lib/profile");
 try{
  for(const [id,role] of [["buyer","ACQUIRER"],["other","ACQUIRER"],["agent","ACQUIRER_AGENT"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  for(const id of ["buyer","other"])await db.acquirer.create({data:{id,reference:id,registeredName:id,email:`${id}@test.invalid`,personId:id,userId:id,file:{create:{id:`file-${id}`,fullName:id,status:"VERIFIED",phone:"+243 000 000 000",city:"Kinshasa",country:"RDC",declarations:{create:{reference:id,status:"APPROVED",contractNumber:"CONTRAT"}}}}}});
  const input={version:0,phone:"+243 000 000 001",city:"Lubumbashi",country:"RDC"};
  await t.test("Accès personnel et aucun changement d’identité injecté",async()=>{
   await assert.rejects(updateProfile("agent",input),/réservé/);
   for(const injected of [{fileId:"file-other"},{email:"autre@test.invalid"},{fullName:"Autre identité"},{status:"VERIFIED"}])await assert.rejects(updateProfile("buyer",{...input,...injected}));
   await assert.rejects(updateProfile("buyer",{...input,phone:"abc"}));await assert.rejects(updateProfile("buyer",{...input,country:""}));
   await updateProfile("buyer",input);
   const file=await db.acquirerFile.findUniqueOrThrow({where:{id:"file-buyer"},include:{declarations:true}});
   assert.equal(file.status,"VERIFIED");assert.equal(file.fullName,"buyer");assert.equal(file.declarations[0].status,"APPROVED");assert.equal(file.declarations[0].contractNumber,"CONTRAT");
   assert.equal((await db.acquirerFile.findUniqueOrThrow({where:{id:"file-other"}})).city,"Kinshasa");
   assert.equal((await db.user.findUniqueOrThrow({where:{id:"buyer"}})).email,"buyer@test.invalid");
  });
  await t.test("Version concurrente, historique et absence de faux changement",async()=>{
   await assert.rejects(updateProfile("buyer",input),/changé/);
   const res=await Promise.allSettled([updateProfile("buyer",{...input,version:1,city:"Matadi"}),updateProfile("buyer",{...input,version:1,city:"Goma"})]);assert.equal(res.filter(r=>r.status==="fulfilled").length,1);
   const file=await db.acquirerFile.findUniqueOrThrow({where:{id:"file-buyer"}});const before=await db.auditEvent.count();
   assert.equal((await updateProfile("buyer",{version:file.version,phone:file.phone,city:file.city,country:file.country})).changed,false);assert.equal(await db.auditEvent.count(),before);
   const event=await db.auditEvent.findFirstOrThrow({where:{action:"PROFILE_UPDATED"},orderBy:{createdAt:"asc"}});assert.equal(JSON.parse(event.detail).before.city,"Kinshasa");assert.equal(JSON.parse(event.detail).after.city,"Lubumbashi");
  });
  await t.test("Compte suspendu et dossier en cours d’examen",async()=>{
   await db.user.update({where:{id:"buyer"},data:{active:false}});await assert.rejects(updateProfile("buyer",{...input,version:2}),/réservé/);
   await db.user.update({where:{id:"buyer"},data:{active:true}});await db.acquirerFile.update({where:{id:"file-buyer"},data:{status:"SUBMITTED"}});
   await updateProfile("buyer",{...input,version:2});const file=await db.acquirerFile.findUniqueOrThrow({where:{id:"file-buyer"}});assert.equal(file.status,"SUBMITTED");assert.equal(file.version,3);
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
