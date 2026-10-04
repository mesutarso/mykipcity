import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { emptyOpportunity, opportunitySchema, opportunityReady, summarizeOpportunity, type Opportunity } from "../src/lib/opportunity-model";
test("FIN-F07 : montants exacts, devises et apports distincts",()=>{
 const value:Opportunity={...emptyOpportunity,costs:[{category:"STUDIES",label:"Étude",amount:"0.30",currency:"USD",documentId:""},{category:"BUILDING",label:"Bâtiment",amount:"1000",currency:"CDF",documentId:""}],resources:[{source:"KIP",kind:"CASH",status:"PROPOSED",label:"Apport",amount:"0.10",currency:"USD",documentId:"",counterpart:""},{source:"OPERATOR",kind:"IN_KIND",status:"PROPOSED",label:"Actif",amount:"0.20",currency:"USD",documentId:"",counterpart:""}]};
 const [usd,cdf]=summarizeOpportunity(value);assert.equal(usd.need,0n);assert.equal(usd.cash,10n);assert.equal(usd.inKind,20n);assert.equal(cdf.need,100000n);assert.equal(usd.complete,false);assert.equal(opportunityReady(value),false);
 assert.throws(()=>opportunitySchema.parse({...value,status:"SIGNED"}));
 assert.throws(()=>opportunitySchema.parse({...value,resources:[{...value.resources[0],status:"DOCUMENTED"}]}));
 assert.throws(()=>opportunitySchema.parse({...value,costs:[{...value.costs[0],amount:"1e5"}]}));
});
test("FIN-F07 : accès, preuves, concurrence et gel de l’étude",async()=>{
 const root=mkdtempSync(join(tmpdir(),"kip-opportunity-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=`${root}/docs`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db");const {createFinanceCase,saveFinanceForm}=await import("../src/lib/finance");const {submitReview}=await import("../src/lib/finance-review");const docs=await import("../src/lib/finance-documents");
 try{
  for(const [id,role] of [["owner","FINANCE_OFFICER"],["other","FINANCE_OFFICER"],["buyer","ACQUIRER"],["reviewer","FINANCE_REVIEWER"],["validator","FINANCE_VALIDATOR"]])await db.user.create({data:{id,role,personId:id,name:id,email:`${id}@test.invalid`}});
  const request={applicantName:"Opérateur test",quality:"OPERATOR",acquirerReference:"",phone:"",email:"",pathway:"CVPSC",need:"CVPSC",otherNeed:"",project:"École",description:"",calendar:"",projectCost:"100",projectCurrency:"USD",contribution:"10",contributionCurrency:"USD",requested:"90",requestedCurrency:"USD",situation:"NONE",institution:"",contact:"",nextContact:"",initialDocuments:""};
  const item=await createFinanceCase("owner",request);
  const save=(version:number,data:Opportunity=emptyOpportunity,actor="owner")=>saveFinanceForm(actor,{id:item.id,version,code:"FIN-F07",data});
  await assert.rejects(save(1,emptyOpportunity,"buyer"),{status:403});await assert.rejects(save(1,emptyOpportunity,"other"),{status:404});
  await db.user.update({where:{id:"owner"},data:{active:false}});await assert.rejects(save(1),{status:403});await db.user.update({where:{id:"owner"},data:{active:true}});
  const raced=await Promise.allSettled([save(1),save(1)]);assert.equal(raced.filter(r=>r.status==="fulfilled").length,1);
  await saveFinanceForm("owner",{id:item.id,version:2,code:"FIN-F02",data:{situationDate:"",dependents:0,lines:[{category:"REGULAR",amount:"100",currency:"USD",period:"MONTH",proof:"ESTIMATED",evidence:"",stability:""}],installmentSource:"",stressScenario:"",risks:"",analystNotes:""}});
  const req=await docs.addRequirement("owner",{caseId:item.id,category:"IDENTITY",label:"Dossier justificatif"});
  const document=await docs.depositFinanceDocument("owner",{requirementId:req.id,version:0},"avis.pdf",Buffer.from("%PDF-1.4 FICTIF"));
  await assert.rejects(save(3,{...emptyOpportunity,financeDocumentId:document.id}),/justificatifs contrôlés/);
  await docs.reviewFinanceDocument("owner",{id:document.id,decision:"ACCEPTED",reason:"Pièce contrôlée pour recette"});
  const submit=(version:number)=>submitReview("owner",{id:item.id,version,reviewerId:"reviewer",validatorId:"validator"});
  await assert.rejects(submit(3),/Complétez l’étude/);
  const complete:Opportunity={...emptyOpportunity,project:"École",operator:"Opérateur",entity:"Entité",location:"Site envisagé",revenues:"Scénario prudent",assets:"Actifs référencés",remuneration:"Loyer envisagé",reporting:"Compte et audit",interests:"Aucun déclaré",visas:"Noms dates et décision dans la pièce",valuesChecked:true,interestsChecked:true,financeDocumentId:document.id,legalDocumentId:document.id,decisionDocumentId:document.id,costs:(["STUDIES","BUILDING","EQUIPMENT","RESERVE"] as const).map(category=>({category,label:category,amount:"100",currency:"USD",documentId:document.id})),resources:[{source:"KIP",kind:"CASH",status:"DOCUMENTED",label:"Apport",amount:"100",currency:"USD",documentId:document.id,counterpart:"Contrepartie décrite"}]};
  assert.equal(opportunityReady(complete),true);
  const foreign=await createFinanceCase("other",request);const foreignReq=await docs.addRequirement("other",{caseId:foreign.id,category:"IDENTITY",label:"Autre justificatif"});const foreignDoc=await docs.depositFinanceDocument("other",{requirementId:foreignReq.id,version:0},"autre.pdf",Buffer.from("%PDF-1.4 AUTRE"));await docs.reviewFinanceDocument("other",{id:foreignDoc.id,decision:"ACCEPTED",reason:"Pièce étrangère contrôlée"});
  await assert.rejects(save(3,{...complete,financeDocumentId:foreignDoc.id}),/justificatifs contrôlés/);
  await save(3,complete);
  const replacement=await docs.depositFinanceDocument("owner",{requirementId:req.id,version:1},"avis2.pdf",Buffer.from("%PDF-1.4 NOUVEAU"));await docs.reviewFinanceDocument("owner",{id:replacement.id,decision:"ACCEPTED",reason:"Nouvelle version contrôlée"});
  await assert.rejects(submit(4),/justificatif de l’étude/);
  const current={...complete,financeDocumentId:replacement.id,legalDocumentId:replacement.id,decisionDocumentId:replacement.id,costs:complete.costs.map(l=>({...l,documentId:replacement.id})),resources:complete.resources.map(l=>({...l,documentId:replacement.id}))};
  await save(4,current);await submit(5);await assert.rejects(save(6,current),{status:409});
  const frozen=await db.financeReview.findUniqueOrThrow({where:{caseId_cycle:{caseId:item.id,cycle:1}}});assert.deepEqual((frozen.snapshot as {opportunity:unknown}).opportunity,current);
  const historic=await db.financeRevision.findUniqueOrThrow({where:{caseId_version:{caseId:item.id,version:4}}});assert.deepEqual(historic.payload,complete);
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
