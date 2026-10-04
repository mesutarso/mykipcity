import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFileSync} from "node:child_process";
import {originalData,originalSituation} from "../src/lib/original-model";
const inventory={nature:"Titre foncier",documentReference:"TF-1",issuer:"Conservation fictive",documentDate:"2025-01-01",parcelReference:"PAR-01",pages:3,initialCondition:"Complet et lisible",depositor:"Client, titulaire vérifié",custodian:"Cabinet fictif, responsable et coordonnées vérifiés",basis:"Garde volontaire documentée",authorizedPeople:"Responsable du Cabinet",returnTerms:"Au titulaire après restitution autorisée",incidentProcedure:"Signalement immédiat au Cabinet et à Finance",copyDelivered:true,authenticityExamined:true};
const base={kind:"DEPOSIT",occurredAt:"2026-01-01T10:00",place:"Bureau du Cabinet",holder:"Cabinet fictif",location:"Coffre A",condition:"Complet et lisible",authority:"Pouvoir du remettant et convention de garde vérifiés",receipt:"RECU-1",signatories:"Remettant et dépositaire, signatures papier examinées",returnDue:"",returnTerms:"",transport:"",discrepancies:"Aucun écart relevé",incidentReference:"",reason:"Remise contradictoire documentée",inventory};
const movement=(kind:string,other:object={})=>{const {inventory:unused,...data}=base;void unused;return {...data,kind,occurredAt:"2026-01-02T10:00",...other};};
test("Originaux : inventaire, garde, contrôles, mouvements et preuves conservées",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-originals-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=join(root,"documents");process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db"),service=await import("../src/lib/originals"),{assignLegal}=await import("../src/lib/legal"),{updateStaff}=await import("../src/lib/team");
 const bytes=Buffer.from("%PDF-1.4 receipt signed fictitiously");let id="",depositId="";
 const item=()=>db.original.findUniqueOrThrow({where:{id},include:{events:{orderBy:{sequence:"asc"}}}});
 const record=async(data:unknown,replacesId?:string,reviewerId="reviewer")=>service.recordOriginal("cabinet",{caseId:"case",id,reference:"ORI-1",version:(await item()).version,reviewerId,data,...(replacesId?{replacesId}:{})},"recu.pdf",bytes);
 const pending=async()=>(await item()).events.find(e=>e.status==="PENDING")!;
 const decide=async(action="ACCEPTED",user="reviewer",checks=true)=>service.decideOriginal(user,{id:(await pending()).id,version:(await item()).version,action,checks,reason:"Inventaire et reçu vérifiés par une autre personne"});
 const confirm=async(data:unknown)=>{await record(data);await decide();};
 try{
  for(const [user,role] of [["cabinet","LEGAL_OFFICER"],["reviewer","LEGAL_OFFICER"],["alias","LEGAL_OFFICER"],["stranger","LEGAL_OFFICER"],["finance","FINANCE_OFFICER"],["control","FINANCE_REVIEWER"],["validator","FINANCE_VALIDATOR"],["buyer","ACQUIRER"],["admin","ADMIN"]])await db.user.create({data:{id:user,name:user,email:`${user}@test.invalid`,personId:user==="alias"?"cabinet":user,role}});
  for(const caseId of ["case","other-case"])await db.financeCase.create({data:{id:caseId,reference:caseId,ownerId:"finance",reviewerId:"control",validatorId:"validator",legalOfficerId:"cabinet",applicantName:"Client fictif",pathway:"HABITAT",request:{}}});
  const input={caseId:"case",reference:"ori-1",version:0,reviewerId:"reviewer",data:base};
  await t.test("Inventaire privé et référence immuable, sans reclassement dans un autre dossier",async()=>{
   for(const user of ["finance","buyer","admin"])await assert.rejects(service.recordOriginal(user,input,"preuve.pdf",bytes),{status:403});
   await assert.rejects(service.recordOriginal("cabinet",{...input,reviewerId:"alias"},"preuve.pdf",bytes),{status:403});assert.equal(readdirSync(join(root,"documents/originals")).length,0);
   id=(await service.recordOriginal("cabinet",input,"../../recu.pdf",bytes)).id;depositId=(await pending()).id;
   await assert.rejects(service.recordOriginal("cabinet",{...input,caseId:"other-case",reference:"ORI-1"},"preuve.pdf",bytes),{status:409});
   for(const user of ["buyer","admin","stranger"])await assert.rejects(service.getOriginal(user,id),{status:404});
   for(const user of ["cabinet","reviewer","finance","control","validator"])assert.equal((await service.getOriginal(user,id)).item.caseId,"case");
   await assert.rejects(service.readOriginalProof("buyer",depositId),{status:404});assert.deepEqual((await service.readOriginalProof("reviewer",depositId)).bytes,bytes);
  });
  await t.test("Double contrôle, suspension, affectations et concurrence",async()=>{
   await assert.rejects(decide("ACCEPTED","cabinet"),{status:403});await assert.rejects(decide("ACCEPTED","reviewer",false),{status:400});
   await assert.rejects(assignLegal("admin",{id:"case",version:1,targetId:"stranger",reason:"Changement du Cabinet responsable"}),{status:409});
   await assert.rejects(updateStaff("admin",{id:"reviewer",version:0,role:"FINANCE_OFFICER",active:true,reason:"Changement de service demandé"}),{status:409});
   await db.user.update({where:{id:"reviewer"},data:{active:false}});await assert.rejects(service.readOriginalProof("reviewer",depositId),{status:403});await assert.rejects(decide(),{status:404});await db.user.update({where:{id:"reviewer"},data:{active:true}});
   const version=(await item()).version;await decide();assert.equal(originalSituation((await item()).events).state,"HELD");
   await assert.rejects(service.decideOriginal("reviewer",{id:depositId,version,action:"ACCEPTED",checks:true,reason:"Seconde décision concurrente"}),{status:409});
   await assert.rejects(service.getOriginal("reviewer",id),{status:404});
   await assert.rejects(service.recordOriginal("cabinet",{...input,id,version:2,caseId:"other-case"},"proof.pdf",bytes),{status:404});
  });
  await t.test("Sortie, détérioration, délai de retour conservé et retour en garde",async()=>{
   await assert.rejects(record(movement("RETURN_TO_CUSTODY")),{status:409});
   await confirm(movement("TEMPORARY_OUT",{holder:"Notaire fictif",location:"Étude notariale",returnDue:"2026-01-10"}));
   assert.equal(originalSituation((await item()).events).state,"OUT");
   await assert.rejects(record(movement("TEMPORARY_OUT",{returnDue:"2026-01-10"})),{status:409});
   await assert.rejects(record(movement("DAMAGE")),{status:409});
   await confirm(movement("DAMAGE",{holder:"Notaire fictif",location:"Étude notariale",condition:"Coin abîmé",discrepancies:"Photographie conservée et déclaration à Finance attendue"}));
   assert.equal(originalSituation((await item()).events).returnDue,"2026-01-10");
   await confirm(movement("RETURN_TO_CUSTODY",{occurredAt:"2026-01-11T10:00",condition:"Coin abîmé"}));assert.equal(originalSituation((await item()).events).state,"HELD");
  });
  await t.test("Chronologie, preuve altérée, retour motivé et retrait du contrôle",async()=>{
   await assert.rejects(record(movement("TRANSFER")),{status:409});
   await record(movement("TRANSFER",{occurredAt:"2026-01-12T10:00",holder:"Cabinet B",location:"Coffre B"}));const e=await pending(),path=join(root,"documents/originals",e.storageKey);
   writeFileSync(path,"altered");await assert.rejects(decide(),{status:409});await assert.rejects(service.readOriginalProof("cabinet",e.id),{status:409});writeFileSync(path,bytes);
   await decide("REJECTED");assert.equal(originalSituation((await item()).events).last!.location,"Coffre A");
   await record(movement("TRANSFER",{occurredAt:"2026-01-12T10:00",holder:"Cabinet B",location:"Coffre B"}));await decide("CANCELLED","cabinet",false);assert.equal(originalSituation((await item()).events).last!.location,"Coffre A");
  });
  await t.test("Perte, référence FIN-F08, pièce retrouvée et correction sans effacement",async()=>{
   await assert.rejects(record(movement("LOSS",{occurredAt:"2026-01-13T10:00",incidentReference:"INC-inexistant"})),{status:409});
   await confirm(movement("LOSS",{occurredAt:"2026-01-13T10:00",holder:"Détenteur inconnu",location:"Lieu inconnu",discrepancies:"Recherche en cours, signalement Finance demandé"}));assert.equal(originalSituation((await item()).events).state,"LOST");
   await assert.rejects(record(movement("TRANSFER",{occurredAt:"2026-01-14T10:00"})),{status:409});
   await confirm(movement("FOUND",{occurredAt:"2026-01-14T10:00"}));const last=originalSituation((await item()).events).effective.at(-1)!;
   const before=await db.originalEvent.findUniqueOrThrow({where:{id:last.id}});await record({...last.data,location:"Coffre A, étage 2",reason:"Précision du lieu après vérification"},last.id);await decide();
   assert.deepEqual(await db.originalEvent.findUniqueOrThrow({where:{id:last.id}}),before);assert.equal(originalSituation((await item()).events).last!.location,"Coffre A, étage 2");
   await assert.rejects(record(base,depositId),{status:409});
  });
  await t.test("Restitution définitive, aucune mainlevée implicite et restauration des reçus",async()=>{
   await confirm(movement("FINAL_RETURN",{occurredAt:"2026-01-15T10:00",holder:"Titulaire vérifié",location:"Chez le titulaire",receipt:"RESTITUTION-1"}));
   assert.equal(originalSituation((await item()).events).state,"RETURNED");await assert.rejects(record(movement("TRANSFER",{occurredAt:"2026-01-16T10:00"})),{status:409});
   assert.equal((await db.financeCase.findUniqueOrThrow({where:{id:"case"}})).status,"DRAFT");assert.equal(await db.legalRecord.count(),0);
   const {createBackup,verifyBackup,restoreBackup}=await import("../scripts/backup");const backup=await createBackup(join(root,"db"),join(root,"documents"),join(root,"backup"));assert.equal(backup.documents,await db.originalEvent.count());const manifest=await verifyBackup(join(root,"backup"));assert.ok(manifest.documents.every(d=>d.path.startsWith("originals/")));await restoreBackup(join(root,"backup"),join(root,"restored"));
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
test("Originaux : validation de l’inventaire et des dates",()=>{
 for(const input of [{...base,occurredAt:"2026-02-30T12:00"},{...base,occurredAt:"2099-01-01T10:00"},{...base,inventory:{...inventory,pages:0}},{...base,inventory:{...inventory,copyDelivered:false}},movement("TEMPORARY_OUT"),movement("TEMPORARY_OUT",{returnDue:"2025-01-01"})])assert.equal(originalData.safeParse(input).success,false);
 assert.equal(originalData.safeParse(movement("TEMPORARY_OUT",{returnTerms:"Après la certification notariale"})).success,true);
});
