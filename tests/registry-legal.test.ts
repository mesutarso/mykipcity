import type {LegalData} from "../src/lib/legal";
import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {simulateFinance} from "../src/lib/simulation";
import {minorUnits} from "../src/lib/finance-model";
test("Registre et Cabinet : corrections, cloisonnement et visas versionnés",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-legal-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DEMO_MODE="true";execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db"),registry=await import("../src/lib/registry-corrections"),legal=await import("../src/lib/legal"),{legalTemplates}=await import("../src/lib/legal-templates");
 try{
  for(const [id,role] of [["agent","ACQUIRER_AGENT"],["buyer","ACQUIRER"],["owner","FINANCE_OFFICER"],["other","FINANCE_OFFICER"],["cabinet","LEGAL_OFFICER"],["visa","LEGAL_OFFICER"],["alias","LEGAL_OFFICER"],["admin","ADMIN"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id==="alias"?"cabinet":id}});
  for(const id of ["source","target"])await db.acquirer.create({data:{id,reference:id.toUpperCase(),registeredName:id,email:`${id}@test.invalid`,personId:id}});
  await t.test("Corrections du registre et regroupement sans suppression ni extension de droits",async()=>{
   const input={id:"target",version:0,kind:"acquirer",name:"Nom corrigé",reason:"Correction justifiée au registre"};await assert.rejects(registry.correctRegistry("buyer",input),{status:403});await registry.correctRegistry("agent",input);await assert.rejects(registry.correctRegistry("agent",input),{status:409});
   await registry.mergeRegistry("agent",{id:"source",version:0,targetReference:"TARGET",confirmed:true,reason:"Doublon confirmé sans dossier"});assert.equal((await db.acquirer.findUniqueOrThrow({where:{id:"source"}})).mergedIntoId,"target");assert.equal(await db.acquirer.count(),2);
   await assert.rejects(registry.correctRegistry("agent",{...input,id:"source",version:1}),{status:404});
   await db.acquirer.update({where:{id:"target"},data:{userId:"buyer",file:{create:{id:"file",fullName:"Ancien nom"}}}});
   await db.document.create({data:{id:"proof",fileId:"file",originalName:"preuve.pdf",storageKey:"proof-key",mimeType:"application/pdf",size:1,sha256:"a".repeat(64)}});
   await registry.correctIdentity("agent",{id:"file",version:0,fullName:"Nom rectifié",proofId:"proof",checked:true,reason:"Concordance vérifiée sur contrat"});assert.equal((await db.acquirerFile.findUniqueOrThrow({where:{id:"file"}})).fullName,"Nom rectifié");assert.equal(await db.auditEvent.count({where:{action:"IDENTITY_CORRECTED"}}),1);
  });
  await t.test("Réexamen de qualité : retrait immédiat des droits et décision conservée",async()=>{
   const {manageParcelAccess}=await import("../src/lib/parcel-access"),{ownFile}=await import("../src/lib/workflow");
   await db.parcel.create({data:{id:"parcel",reference:"P1",area:100,cadastralReference:"CAD1"}});
   await db.parcelDeclaration.create({data:{id:"declaration",fileId:"file",reference:"P1",contractNumber:"C1",parcelId:"parcel",status:"APPROVED",reviewedBy:"agent",reviewedAt:new Date()}});
   await db.acquirerFile.update({where:{id:"file"},data:{status:"VERIFIED"}});
   await assert.rejects(manageParcelAccess("buyer",{id:"declaration",version:1,action:"REEXAMINE",reason:"Changement de qualité à examiner"}),{status:403});
   await manageParcelAccess("agent",{id:"declaration",version:1,action:"REEXAMINE",reason:"Changement de qualité à examiner"});
   const file=await ownFile("buyer");assert.equal(file.status,"NEEDS_INFO");assert.equal(file.declarations[0].status,"PENDING");assert.equal(file.declarations[0].parcel,null);
   const event=await db.auditEvent.findFirstOrThrow({where:{action:"PARCEL_ACCESS_REEXAMINE"}});assert.equal(JSON.parse(event.detail).before.status,"APPROVED");
  });
  await db.financeCase.create({data:{id:"case",reference:"FIN-JUR",ownerId:"owner",applicantName:"Buyer",pathway:"HABITAT",request:{}}});
  await legal.assignLegal("admin",{id:"case",version:1,targetId:"cabinet",reason:"Mandat confié au Cabinet désigné"});
  await db.financeRequirement.create({data:{id:"req",caseId:"case",category:"OTHER",label:"Acte examiné",version:1,documents:{create:{id:"legal-proof",revision:1,originalName:"acte.pdf",storageKey:"legal-proof",mimeType:"application/pdf",size:1,sha256:"b".repeat(64),status:"ACCEPTED",uploadedBy:"owner"}}}});
  await t.test("Les sept annexes conservent deux parties et refusent les accès non affectés",async()=>{
   assert.equal(Object.keys(legalTemplates).length,7);for(const template of Object.values(legalTemplates)){assert.equal(template.sections.length,2);const keys=template.sections.flatMap(s=>s.fields.map(f=>f.key));assert.equal(keys.length,new Set(keys).size);}
   for(const user of ["buyer","agent","admin","other","visa"])await assert.rejects(legal.legalCase(user,"case"),{status:404});await legal.legalCase("owner","case");await legal.legalCase("cabinet","case");
  });
  await t.test("Visa par partie, preuves actuelles, indépendance, gel et reprise",async()=>{
   const template=legalTemplates["JUR-J04"],data:LegalData={values:{},checks:{},proofIds:["legal-proof"]};
   for(const f of template.sections[0].fields)data.values[f.key]="Constat documenté pour cette rubrique";
   for(const c of template.sections[0].checks)data.checks[c.key]={state:"V",reason:"Contrôle réalisé sur la preuve",proofId:"legal-proof"};
   const input={caseId:"case",code:"JUR-J04",version:0,title:"Examen préalable de l’acte",reason:"Préparation de la première partie",data};
   await assert.rejects(legal.saveLegal("owner",input),{status:403});const {id}=await legal.saveLegal("cabinet",input);
   const submit={id,version:1,action:"SUBMIT",part:1,reviewerId:"visa",reason:"Examen indépendant de la première partie"};
   await assert.rejects(legal.decideLegal("cabinet",{...submit,reviewerId:"alias"}),{status:403});await assert.rejects(legal.decideLegal("cabinet",{...submit,part:2}));await legal.decideLegal("cabinet",submit);
   await assert.rejects(legal.saveLegal("cabinet",{...input,id,version:2}),{status:409});await legal.legalCase("visa","case");
   await legal.decideLegal("visa",{id,version:2,action:"VISA",reason:"Première partie contrôlée sur preuves"});
   const frozen=await db.legalRevision.findUniqueOrThrow({where:{recordId_version:{recordId:id,version:3}}});assert.equal((frozen.data as {reviewPart:number}).reviewPart,1);
   await legal.decideLegal("cabinet",{id,version:3,action:"REOPEN",reason:"Compléter les formalités après signature"});await legal.saveLegal("cabinet",{...input,id,version:4,title:"Suivi après signature"});
   assert.deepEqual((await db.legalRevision.findUniqueOrThrow({where:{id:frozen.id}})).data,frozen.data);
   await db.financeDocument.update({where:{id:"legal-proof"},data:{status:"REJECTED"}});await assert.rejects(legal.decideLegal("cabinet",{...submit,version:5}),{status:409});
   assert.equal((await db.financeCase.findUniqueOrThrow({where:{id:"case"}})).status,"DRAFT");
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
test("Simulation : taux nul, arrondis, capital amorti et coût incomplet",()=>{
 const input={principal:"1200",currency:"USD",months:12,annualRate:"0",fees:"0",monthlyInsurance:"0",source:"Hypothèse de recette",sourceDate:"2026-09-30",hypothesis:"Sans frais ni assurance"};
 const zero=simulateFinance(input);assert.equal(zero.installment,"100.00");assert.equal(zero.completeCost,"1200.00");assert.equal(zero.schedule.at(-1)!.balance,"0.00");
 const interest=simulateFinance({...input,principal:"10000",annualRate:"12",fees:null});assert.equal(interest.installment,"888.49");assert.equal(interest.completeCost,null);assert.equal(interest.schedule.reduce((sum,r)=>sum+minorUnits(r.principal),0n),1000000n);assert.equal(interest.schedule.at(-1)!.balance,"0.00");
 const rounding=simulateFinance({...input,principal:"1",months:3});assert.equal(rounding.schedule.at(-1)!.installment,"0.34");assert.throws(()=>simulateFinance({...input,annualRate:"101"}));assert.throws(()=>simulateFinance({...input,principal:"0"}));
});
