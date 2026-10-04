import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
test("Incidents : réception, confidentialité, responsabilité et clôture",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-incidents-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db");const svc=await import("../src/lib/incidents");const {emptyProgress}=await import("../src/lib/incident-model");
 try{
  for(const [id,role,personId] of [["reporter","FINANCE_OFFICER","p1"],["owner","FINANCE_OFFICER","p2"],["next","FINANCE_OFFICER","p3"],["accused","FINANCE_OFFICER","p4"],["alias","FINANCE_OFFICER","p4"],["admin","ADMIN","p5"],["buyer","ACQUIRER","p6"]])await db.user.create({data:{id,role,personId,name:id,email:`${id}@test.invalid`}});
  const input={caseId:"",title:"Incident fictif",channel:"PHONE",reporter:"Déclarant fictif",contact:"",category:"DATA",project:"",description:"Signalement factuel de test",evidence:"Référence preuve",amount:"0,10",currency:"USD",urgency:"DATA_EXPOSURE",immediateMeasure:"Accès concerné isolé",ownerId:"owner",implicatedUserId:"accused"};
  await t.test("Réception sans signature ni dossier, affectation indépendante",async()=>{
   await assert.rejects(svc.createIncident("buyer",input),/réservé/);
   await assert.rejects(svc.createIncident("admin",input),/réservé/);
   await assert.rejects(svc.createIncident("reporter",{...input,ownerId:"accused"}),/distinct/);
   await assert.rejects(svc.createIncident("reporter",{...input,ownerId:"alias"}),/distinct/);
   await assert.rejects(svc.createIncident("reporter",{...input,caseId:"foreign"}),/inaccessible/);
   await assert.rejects(svc.createIncident("reporter",{...input,amount:"1e3"}));
   await assert.rejects(svc.createIncident("reporter",{...input,status:"CLOSED"}));
  });
  const created=await svc.createIncident("reporter",input);
  await t.test("Accès limité au créateur et responsable, exclusion de la personne mise en cause",async()=>{
   assert.equal((await svc.getIncident("owner",created.id)).status,"RECEIVED");assert.equal((await svc.getIncident("reporter",created.id)).caseId,null);
   for(const id of ["next","accused","alias"])await assert.rejects(svc.getIncident(id,created.id),/inaccessible/);
   const selfReport=await svc.createIncident("accused",{...input,title:"Auto-signalement fictif"});assert.equal(selfReport.canRead,false);
   await assert.rejects(svc.getIncident("accused",selfReport.id),/inaccessible/);
   assert.equal((await svc.getIncident("owner",selfReport.id)).reference,selfReport.reference);
  });
  const update={id:created.id,version:1,ownerId:"owner",status:"ANALYSIS",reason:"Prise en charge de la recette",progress:{...emptyProgress,immediateMeasure:"Mesure conservée"}};
  await t.test("Traitement réservé au responsable et décisions concurrentes",async()=>{
   await assert.rejects(svc.updateIncident("reporter",update),/Seul le responsable/);
   await assert.rejects(svc.updateIncident("owner",{...update,status:"CLOSED"}),/changement/);
   await assert.rejects(svc.updateIncident("owner",{...update,status:"ESCALATED"}),/à qui/);
   const results=await Promise.allSettled([svc.updateIncident("owner",update),svc.updateIncident("owner",update)]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
   assert.equal((await svc.getIncident("owner",created.id)).events.length,2);
  });
  await t.test("Transfert tracé, ancienne responsabilité retirée et compte suspendu refusé",async()=>{
   await assert.rejects(svc.updateIncident("owner",{...update,version:2,ownerId:"alias"}),/distinct/);
   await svc.updateIncident("owner",{...update,version:2,ownerId:"next"});
   await assert.rejects(svc.getIncident("owner",created.id),/inaccessible/);
   await assert.rejects(svc.updateIncident("owner",{...update,version:3}),/responsable/);
   await db.user.update({where:{id:"next"},data:{active:false}});await assert.rejects(svc.getIncident("next",created.id),/suspendu/);await db.user.update({where:{id:"next"},data:{active:true}});
   assert.equal((await svc.getIncident("next",created.id)).ownerId,"next");
  });
  await t.test("Résolution et clôture motivées, réponse datée et réouverture",async()=>{
   await assert.rejects(svc.updateIncident("next",{...update,version:3,ownerId:"next",status:"RESOLVED"}),/constat/);
   const progress={...emptyProgress,findings:"Constat vérifié",correction:"Correction effectuée",decision:"Décision documentée"};
   await svc.updateIncident("next",{...update,version:3,ownerId:"next",status:"RESOLVED",progress});
   await assert.rejects(svc.updateIncident("next",{...update,version:4,ownerId:"next",status:"CLOSED",progress}),/réponse/);
   const final={...progress,clientResponse:"Réponse fictive consignée",respondedOn:"2026-01-01",prevention:"Mesure de prévention"};
   await assert.rejects(svc.updateIncident("next",{...update,version:4,ownerId:"next",status:"CLOSED",progress:{...final,respondedOn:"2099-01-01"}}),/futur/);
   await svc.updateIncident("next",{...update,version:4,ownerId:"next",status:"CLOSED",progress:final});
   const closed=await svc.getIncident("next",created.id);assert.equal(closed.status,"CLOSED");assert.equal(closed.events[0].actorName,"next");
   await assert.rejects(svc.updateIncident("next",{...update,version:5,ownerId:"next",status:"CLOSED",progress:final}),/changement/);
   await svc.updateIncident("next",{...update,version:5,ownerId:"next",status:"CONTESTED",progress:final,reason:"Réouverture à la demande du déclarant"});
   assert.equal((await svc.getIncident("next",created.id)).status,"CONTESTED");
   const first=await db.financeIncidentEvent.findUniqueOrThrow({where:{incidentId_version:{incidentId:created.id,version:1}}});assert.ok(JSON.stringify(first.snapshot).includes("Signalement factuel de test"));
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
