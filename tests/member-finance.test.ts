import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
test("Suivi acquéreur : publication explicite et données cloisonnées",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-member-finance-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db");const svc=await import("../src/lib/member-finance");
 try{
  for(const [id,role] of [["finance","FINANCE_OFFICER"],["otherFinance","FINANCE_OFFICER"],["buyer","ACQUIRER"],["otherBuyer","ACQUIRER"],["pendingBuyer","ACQUIRER"],["admin","ADMIN"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  for(const id of ["buyer","otherBuyer","pendingBuyer"])await db.acquirer.create({data:{id:`a-${id}`,reference:`ACQ-${id}`,registeredName:id,email:`${id}@test.invalid`,personId:id,userId:id,file:{create:{declarations:{create:{reference:`PARCEL-${id}`,contractNumber:"TEST",status:id==="pendingBuyer"?"PENDING":"APPROVED"}}}}}});
  const item=await db.financeCase.create({data:{ownerId:"finance",acquirerId:"a-buyer",reference:"FIN-MEMBER",applicantName:"Interne nom",pathway:"HABITAT",request:{internalSecret:"NEVER_SHARE_REQUEST"},budget:{analystNotes:"NEVER_SHARE_BUDGET"}}});
  const data={title:"Votre étude de financement",stage:"IN_PROGRESS",message:"Votre référent prépare votre dossier.",documents:[],appointmentDate:"",appointmentTime:"",appointmentPlace:"",contact:"Équipe Finance"};
  const save=(version:number,content=data)=>svc.manageMemberUpdate("finance",{action:"save",caseId:item.id,version,data:content});
  const act=(action:string,version:number)=>svc.manageMemberUpdate("finance",{action,caseId:item.id,version});
  await t.test("Brouillon invisible, publication réservée au référent",async()=>{
   await assert.rejects(svc.manageMemberUpdate("otherFinance",{action:"save",caseId:item.id,version:0,data}),/inaccessible/);
   await assert.rejects(svc.manageMemberUpdate("buyer",{action:"save",caseId:item.id,version:0,data}),/réservé/);
   await assert.rejects(svc.manageMemberUpdate("finance",{action:"save",caseId:item.id,version:0,data:{...data,internalNotes:"injected"}}));
   await save(0);assert.deepEqual(await svc.memberFinance("buyer"),[]);
   await act("publish",1);
   const rows=await svc.memberFinance("buyer");assert.equal(rows.length,1);assert.equal(rows[0].content.message,data.message);
   assert.ok(!JSON.stringify(rows).includes("NEVER_SHARE"));assert.ok(!JSON.stringify(rows).includes("Interne nom"));
   assert.deepEqual(await svc.memberFinance("otherBuyer"),[]);await assert.rejects(svc.memberFinance("admin"),/réservé/);
  });
  await t.test("Nouvelle préparation distincte de la publication, conflits et retrait",async()=>{
   await save(2,{...data,message:"Nouvelle information encore en brouillon."});
   assert.equal((await svc.memberFinance("buyer"))[0].content.message,data.message);
   await assert.rejects(act("withdraw",2),/changé/);
   const results=await Promise.allSettled([act("publish",3),act("publish",3)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
   assert.equal((await svc.memberFinance("buyer"))[0].content.message,"Nouvelle information encore en brouillon.");
   await act("withdraw",4);assert.deepEqual(await svc.memberFinance("buyer"),[]);
   await act("publish",5);
  });
  await t.test("Droits retirés : compte suspendu, parcelle et changement de destinataire",async()=>{
   await db.user.update({where:{id:"buyer"},data:{active:false}});await assert.rejects(svc.memberFinance("buyer"),/suspendu/);await assert.rejects(act("publish",6),/actif/);await db.user.update({where:{id:"buyer"},data:{active:true}});
   await db.parcelDeclaration.updateMany({where:{reference:"PARCEL-buyer"},data:{status:"PENDING"}});assert.deepEqual(await svc.memberFinance("buyer"),[]);await assert.rejects(act("publish",6),/validée/);await db.parcelDeclaration.updateMany({where:{reference:"PARCEL-buyer"},data:{status:"APPROVED"}});
   await db.financeCase.update({where:{id:item.id},data:{acquirerId:"a-otherBuyer"}});
   assert.deepEqual(await svc.memberFinance("buyer"),[]);assert.deepEqual(await svc.memberFinance("otherBuyer"),[]);
   await db.financeCase.update({where:{id:item.id},data:{acquirerId:"a-pendingBuyer"}});await assert.rejects(act("publish",6),/validée/);
   await db.financeCase.update({where:{id:item.id},data:{acquirerId:null}});await assert.rejects(act("publish",6),/lié/);
  });
  await t.test("Rendez-vous et pièces demandées cohérents, pas d’état bancaire inventé",async()=>{
   await assert.rejects(save(6,{...data,stage:"ACTION_REQUIRED"}));
   await assert.rejects(save(6,{...data,stage:"APPOINTMENT",appointmentDate:"2026-10-01"}));
   await assert.rejects(save(6,{...data,stage:"CREDIT_APPROVED"}));
   await save(6,{...data,stage:"APPOINTMENT",appointmentDate:"2026-10-01",appointmentTime:"10:30",appointmentPlace:"Bureau Kip-City"});
   assert.equal(await db.auditEvent.count({where:{objectId:item.id,action:"MEMBER_FINANCE_PUBLISH"}}),3);
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
