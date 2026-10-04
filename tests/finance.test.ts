import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { minorUnits,money,summarizeBudget,requestSchema,budgetSchema,type FinanceBudget } from "../src/lib/finance-model";

test("Montants exacts, périodes et devises séparées",()=>{
  assert.equal(minorUnits("0,10")+minorUnits("0.20"),30n);
  assert.equal(minorUnits("999999999999.99"),99999999999999n);
  for(const bad of ["1e3","1.001","-1","Infinity","abc","1000000000000"])assert.throws(()=>minorUnits(bad));
  assert.equal(money(-101n,"USD"),"−1,01 USD");
  const line=(category:FinanceBudget["lines"][number]["category"],amount:string,currency:"USD"|"CDF"="USD",period:"MONTH"|"ONCE"="MONTH")=>({category,amount,currency,period,proof:"UNKNOWN" as const,evidence:"",stability:""});
  const budget=budgetSchema.parse({situationDate:"2026-09-29",dependents:2,lines:[line("REGULAR","1000"),line("VARIABLE","0"),line("ESSENTIAL","200"),line("DEBT","100"),line("INSTALLMENT","100"),line("REGULAR","200000","CDF"),line("WORKS","5000","USD","ONCE"),line("FEES","0","USD","ONCE"),line("FINANCING","0","USD","ONCE"),line("PROVISION","0","USD","ONCE"),line("RESOURCES","1000","USD","ONCE")],installmentSource:"",stressScenario:"",risks:"",analystNotes:""});
  const [usd,cdf]=summarizeBudget(budget);
  assert.equal(usd.remainder,60000n);assert.equal(usd.monthlyComplete,true);assert.equal(usd.need,400000n);assert.equal(usd.projectComplete,true);
  assert.equal(cdf.costProvided,false);assert.equal(cdf.resourcesProvided,false);assert.equal(cdf.monthlyComplete,false);assert.equal(cdf.projectComplete,false);
  assert.equal(summarizeBudget({...budget,lines:budget.lines.filter(l=>l.category!=="INSTALLMENT")})[0].monthlyComplete,false);
  assert.equal(summarizeBudget({...budget,lines:budget.lines.map(l=>l.category==="REGULAR"?{...l,period:"YEAR"}:l)})[0].monthlyComplete,false);
  assert.throws(()=>budgetSchema.parse({...budget,lines:[{...budget.lines[0],proof:"DOCUMENTED",evidence:""}]}));
  assert.throws(()=>budgetSchema.parse({...budget,lines:[line("WORKS","3","USD","MONTH")]}));
});

test("Dossiers Finance : cloisonnement, brouillons, versions et concurrence",async t=>{
  const root=mkdtempSync(join(tmpdir(),"kip-finance-"));
  process.env.DOCUMENTS_DIR=`${root}/documents`;process.env.DATABASE_URL=`file:${root}/finance.db`;process.env.DEMO_MODE="true";
  execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
  const {db}=await import("../src/lib/db");const service=await import("../src/lib/finance");
  const request=requestSchema.parse({applicantName:"Candidat Finance",quality:"CANDIDATE",acquirerReference:"",phone:"",email:"",pathway:"HABITAT",need:"HABITAT",otherNeed:"",project:"Maison",description:"Construction",calendar:"",projectCost:"15000.10",projectCurrency:"USD",contribution:"5000",contributionCurrency:"USD",requested:"10000.10",requestedCurrency:"USD",situation:"NONE",institution:"",contact:"",nextContact:"",initialDocuments:""});
  try{
    for(const [id,role] of [["finance","FINANCE_OFFICER"],["other","FINANCE_OFFICER"],["agent","ACQUIRER_AGENT"],["buyer","ACQUIRER"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:`person-${id}`}});
    await t.test("Un candidat reste interne et ne reçoit aucun compte",async()=>{
      const before=await db.user.count();await service.createFinanceCase("finance",request);assert.equal(await db.user.count(),before);assert.equal(await db.acquirer.count(),0);
    });
    const created=await service.createFinanceCase("finance",request);
    await t.test("Accès métier distinct et affectation obligatoire",async()=>{
      for(const actor of ["buyer","agent"])await assert.rejects(service.createFinanceCase(actor,request),/réservé/);
      await assert.rejects(service.financeCase("other",created.id),/inaccessible/);
      await assert.rejects(service.saveFinanceForm("other",{id:created.id,version:1,code:"FIN-F01",data:request}),/inaccessible/);
      assert.equal((await service.financeCase("finance",created.id)).status,"DRAFT");
    });
    await t.test("Injection d’état et fausse qualité vérifiée refusées",async()=>{
      await assert.rejects(service.createFinanceCase("finance",{...request,status:"APPROVED"}));
      await assert.rejects(service.createFinanceCase("finance",{...request,quality:"VERIFIED"}));
      await db.acquirer.create({data:{reference:"ACQ-X",registeredName:"X test",email:"x@test.invalid",personId:"px"}});
      await assert.rejects(service.createFinanceCase("finance",{...request,quality:"VERIFIED",acquirerReference:"ACQ-X"}),/rattachement validé/);
    });
    await t.test("Sauvegarde atomique, ancienne version intacte et mise à jour concurrente refusée",async()=>{
      const changed={...request,requested:"12000.20"};
      const results=await Promise.allSettled([1,2].map(()=>service.saveFinanceForm("finance",{id:created.id,version:1,code:"FIN-F01",data:changed})));
      assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
      const item=await service.financeCase("finance",created.id);assert.equal(item.version,2);assert.equal(item.revisions.length,2);
      const first=await db.financeRevision.findUniqueOrThrow({where:{caseId_version:{caseId:created.id,version:1}}});
      assert.equal(requestSchema.parse(first.payload).requested,"10000.10");
      assert.equal(requestSchema.parse(item.request).requested,"12000.20");
      await service.saveFinanceForm("finance",{id:created.id,version:2,code:"FIN-F02",data:{situationDate:"",dependents:0,lines:[{category:"REGULAR",amount:"1000",currency:"USD",period:"MONTH",proof:"ESTIMATED",evidence:"",stability:""}],installmentSource:"",stressScenario:"",risks:"",analystNotes:"Interne"}});
      assert.equal((await service.financeCase("finance",created.id)).version,3);
      await db.financeCase.update({where:{id:created.id},data:{status:"LOCKED"}});
      await assert.rejects(service.saveFinanceForm("finance",{id:created.id,version:3,code:"FIN-F01",data:request}),/plus être modifiée/);
    });
    await t.test("Pièces Finance privées, remplacements versionnés et contrôles concurrents",async()=>{
      const docs=await import("../src/lib/finance-documents");
      const item=await service.createFinanceCase("finance",request);
      const input={caseId:item.id,category:"INCOME",label:"Revenus des trois derniers mois"};
      await assert.rejects(docs.addRequirement("agent",input),/réservé/);
      await assert.rejects(docs.addRequirement("other",input),/inaccessible/);
      const req=await docs.addRequirement("finance",input);
      const bytes=Buffer.from("%PDF-1.4 FICTIF TEST");
      await assert.rejects(docs.depositFinanceDocument("other",{requirementId:req.id,version:0},"revenus.pdf",bytes),/inaccessible/);
      await assert.rejects(docs.depositFinanceDocument("finance",{requirementId:req.id,version:0},"faux.pdf",Buffer.from("not pdf")),/Format/);
      const first=await docs.depositFinanceDocument("finance",{requirementId:req.id,version:0},"revenus.pdf",bytes);
      assert.equal((await docs.readFinanceDocument("finance",first.id)).bytes.toString(),bytes.toString());
      await assert.rejects(docs.readFinanceDocument("other",first.id),/inaccessible/);
      await assert.rejects(docs.readFinanceDocument("buyer",first.id),{status:404});
      const before=readdirSync(`${root}/documents/finance`).length;
      await assert.rejects(docs.depositFinanceDocument("finance",{requirementId:req.id,version:0},"stale.pdf",bytes),/a changé/);
      assert.equal(readdirSync(`${root}/documents/finance`).length,before);
      const decisions=await Promise.allSettled([1,2].map(()=>docs.reviewFinanceDocument("finance",{id:first.id,decision:"ACCEPTED",reason:"Pièce lisible et cohérente"})));
      assert.equal(decisions.filter(d=>d.status==="fulfilled").length,1);
      const second=await docs.depositFinanceDocument("finance",{requirementId:req.id,version:1},"revenus-v2.pdf",bytes);
      assert.equal((await db.financeDocument.findUniqueOrThrow({where:{id:second.id}})).status,"PENDING");
      assert.equal((await db.financeDocument.findUniqueOrThrow({where:{id:first.id}})).status,"ACCEPTED");
      await assert.rejects(docs.reviewFinanceDocument("finance",{id:first.id,decision:"REJECTED",reason:"Ancienne version"}),/plus récente/);
      await docs.reviewFinanceDocument("finance",{id:second.id,decision:"REJECTED",reason:"Justificatif incomplet"});
      const saved=await db.financeDocument.findUniqueOrThrow({where:{id:second.id}});
      writeFileSync(`${root}/documents/finance/${saved.storageKey}`,"tampered");
      await assert.rejects(docs.readFinanceDocument("finance",second.id),/ne correspond plus/);
      assert.equal(await db.financeDocument.count({where:{requirementId:req.id}}),2);
    });
    await t.test("Institutions : droits, doublons, édition concurrente et conservation des coordonnées",async()=>{
      const inst=await import("../src/lib/institutions");
      const input={name:"Institution Essai",branch:"Agence Centre",contactName:"Référent initial",contactRole:"Chargé de clientèle",email:"contact@test.invalid",phone:"",address:"",notes:""};
      await assert.rejects(inst.saveInstitution("agent",{data:input}),/réservé/);
      const saved=await inst.saveInstitution("finance",{data:input});
      await assert.rejects(inst.saveInstitution("finance",{data:{...input,name:"institution essai"}}),/déjà/);
      await assert.rejects(inst.saveInstitution("other",{id:saved.id,version:1,data:input}),/inaccessible/);
      await inst.saveInstitution("finance",{id:saved.id,version:1,data:{...input,contactName:"Référent suivant"}});
      await assert.rejects(inst.saveInstitution("finance",{id:saved.id,version:1,data:input}),/modifiée/);
    });
    await t.test("Offres : preuve contrôlée du bon dossier, validité, versions et séparation des accès",async()=>{
      const inst=await import("../src/lib/institutions");
      const model=await import("../src/lib/institution-model");
      const docs=await import("../src/lib/finance-documents");
      const caseItem=await service.createFinanceCase("finance",request);
      const institution=await db.financeInstitution.findFirstOrThrow({where:{ownerId:"finance"}});
      const offer=model.offerSchema.parse({...Object.fromEntries(Object.keys(model.offerFields).map(key=>[key,""])),product:"Habitat",amount:"10000.10",currency:"USD",durationMonths:"60",responseDate:"2026-09-01",validUntil:"2026-09-30",author:"Chargé de clientèle",writtenReference:"OFFRE-001",documentId:"",rateMethod:"DECLINING"});
      assert.equal(model.offerValidity(offer,"2026-10-01"),"Date de validité dépassée");
      assert.equal(model.offerValidity(offer,"2026-09-30"),"Dans la période indiquée");
      assert.throws(()=>model.offerSchema.parse({...offer,validUntil:"2026-08-01"}));
      const command={caseId:caseItem.id,institutionId:institution.id,data:offer};
      await assert.rejects(inst.saveOffer("agent",command),/réservé/);
      await assert.rejects(inst.saveOffer("other",command),/inaccessible/);
      await assert.rejects(inst.saveOffer("finance",{...command,data:{...offer,approved:true}}));
      const req=await docs.addRequirement("finance",{caseId:caseItem.id,category:"BANK",label:"Réponse écrite"});
      const doc=await docs.depositFinanceDocument("finance",{requirementId:req.id,version:0},"offre.pdf",Buffer.from("%PDF-1.4 FICTIF"));
      await assert.rejects(inst.saveOffer("finance",{...command,data:{...offer,documentId:doc.id}}),/contrôlée/);
      await docs.reviewFinanceDocument("finance",{id:doc.id,decision:"ACCEPTED",reason:"Réponse écrite contrôlée"});
      const createdOffer=await inst.saveOffer("finance",{...command,data:{...offer,documentId:doc.id}});
      const otherCase=await service.createFinanceCase("finance",request);
      await assert.rejects(inst.saveOffer("finance",{...command,caseId:otherCase.id,data:{...offer,documentId:doc.id}}),/ce dossier/);
      const before=await db.financeOffer.findUniqueOrThrow({where:{id:createdOffer.id}});
      await inst.saveInstitution("finance",{id:institution.id,version:institution.version,data:{name:institution.name,branch:institution.branch,contactName:"Nouveau contact",contactRole:"",email:"",phone:"",address:"",notes:""}});
      assert.deepEqual((await db.financeOffer.findUniqueOrThrow({where:{id:createdOffer.id}})).institutionSnapshot,before.institutionSnapshot);
      await inst.saveOffer("finance",{...command,id:createdOffer.id,version:1,data:{...offer,amount:"12000.20",documentId:doc.id}});
      await assert.rejects(inst.saveOffer("finance",{...command,id:createdOffer.id,version:1}),/modifiée/);
      const first=await db.financeOfferRevision.findUniqueOrThrow({where:{offerId_version:{offerId:createdOffer.id,version:1}}});
      assert.equal(model.offerSchema.parse(first.data).amount,"10000.10");
      await docs.depositFinanceDocument("finance",{requirementId:req.id,version:1},"offre-v2.pdf",Buffer.from("%PDF-1.4 FICTIF V2"));
      await assert.rejects(inst.saveOffer("finance",{...command,id:createdOffer.id,version:2,data:{...offer,documentId:doc.id}}),/dernière version/);
    });
    await t.test("Un compte suspendu perd l’accès Finance",async()=>{
      await db.user.update({where:{id:"finance"},data:{active:false}});
      await assert.rejects(service.financeCase("finance",created.id),/suspendu/);
    });
  }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
