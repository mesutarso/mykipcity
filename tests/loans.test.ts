import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,writeFileSync,readdirSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFileSync} from "node:child_process";
import {effectiveLoanFacts,loanDataSchema,validateLoanFacts,type LoanData} from "../src/lib/loan-model";
const common={reference:"D-1",documentVersion:"1",eventDate:"2026-01-01",receivedDate:"2026-01-02",source:"Banque fictive — service crédits",reason:"Saisie vérifiée sur document du prêteur"};
const decision={...common,kind:"DECISION",outcome:"AGREED",amount:"1200",conditions:"Accord sans réserve"} as const;
const contract={...common,kind:"CONTRACT",reference:"CON-1",amount:"1200",offerReference:"OFF-1",parties:"Prêteur et emprunteur identifiés",conditions:"Formalités examinées"} as const;
const schedule={...common,kind:"SCHEDULE",reference:"ECH-1",effectiveDate:"2026-01-01",rows:[{reference:"M01",date:"2026-02-01",amount:"100"},{reference:"M02",date:"2026-03-01",amount:"100"}]} as const;
const disbursement={...common,kind:"DISBURSEMENT",reference:"TR-1",amount:"600",valueDate:"2026-01-01",beneficiaryType:"SUPPLIER",beneficiary:"Entreprise fictive",conditions:"Formalités de versement vérifiées"} as const;
const payment={...common,kind:"PAYMENT",reference:"PAY-1",amount:"100",valueDate:"2026-01-01",installmentReference:"M01",payer:"Emprunteur fictif"} as const;
test("Prêts : circuit documenté, contrôle indépendant, versions et preuves privées",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-loans-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=join(root,"documents");process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db"),service=await import("../src/lib/loans");
 const bytes=Buffer.from("%PDF-1.4 fictitious proof");let loanId="",oldDecision="";
 const version=async()=>(await db.loan.findUniqueOrThrow({where:{id:loanId}})).version;
 const deposit=async(data:unknown,replacesId?:string)=>service.depositLoanEvent("owner",{loanId,version:await version(),data,...(replacesId?{replacesId}:{})},"preuve.pdf",bytes);
 const review=async(id:string,decision="ACCEPTED",user="reviewer")=>service.reviewLoanEvent(user,{id,version:await version(),decision,sourceChecked:true,reason:"Source authentique et concordance examinées"});
 const record=async(data:unknown)=>{const e=await deposit(data);await review(e.id);return e.id;};
 try{
  for(const [id,role] of [["owner","FINANCE_OFFICER"],["other","FINANCE_OFFICER"],["reviewer","FINANCE_REVIEWER"],["alias","FINANCE_REVIEWER"],["validator","FINANCE_VALIDATOR"],["cabinet","LEGAL_OFFICER"],["member","ACQUIRER"],["admin","ADMIN"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id==="alias"?"owner":id}});
  await db.financeCase.create({data:{id:"case",reference:"FIN-LOAN",ownerId:"owner",reviewerId:"reviewer",validatorId:"validator",legalOfficerId:"cabinet",status:"INTERNALLY_VALIDATED",applicantName:"Client fictif",pathway:"HABITAT",request:{}}});
  await db.financeInstitution.create({data:{id:"bank",ownerId:"owner",identityKey:"bank",name:"Banque fictive",branch:"Agence",contactName:"",contactRole:"",email:"",phone:"",address:"",notes:""}});
  await t.test("Création, cloisonnement et refus des doublons",async()=>{
   const input={caseId:"case",institutionId:"bank",reference:"bank-ref",currency:"USD"};
   await assert.rejects(service.createLoan("member",input),{status:404});loanId=(await service.createLoan("owner",input)).id;
   await assert.rejects(service.createLoan("owner",{...input,reference:"BANK-REF"}),{status:409});
   for(const user of ["member","other","admin"])await assert.rejects(service.loanCase(user,"case"),{status:404});
   for(const user of ["owner","reviewer","validator","cabinet"])assert.equal((await service.loanCase(user,"case")).loans.length,1);
  });
  await t.test("Aucun contrat sans accord contrôlé ; dépôt figé, accès et indépendance par personne",async()=>{
   await assert.rejects(deposit(contract),{status:409});assert.equal(readdirSync(join(root,"documents/loans")).length,0);
   oldDecision=(await deposit(decision)).id;assert.equal(effectiveLoanFacts((await service.loanCase("owner","case")).loans[0].events).length,0);
   await assert.rejects(deposit(contract),{status:409});await assert.rejects(review(oldDecision,"ACCEPTED","owner"),{status:403});
   await db.financeCase.update({where:{id:"case"},data:{reviewerId:"alias"}});await assert.rejects(review(oldDecision,"ACCEPTED","alias"),{status:403});await db.financeCase.update({where:{id:"case"},data:{reviewerId:"reviewer"}});
   await assert.rejects(service.readLoanProof("member",oldDecision),{status:404});assert.deepEqual((await service.readLoanProof("cabinet",oldDecision)).bytes,bytes);
   await review(oldDecision);await assert.rejects(review(oldDecision),{status:409});
   await db.user.update({where:{id:"reviewer"},data:{active:false}});await assert.rejects(service.readLoanProof("reviewer",oldDecision),{status:404});await db.user.update({where:{id:"reviewer"},data:{active:true}});
  });
  let paymentId="";
  await t.test("Contrat, tranches distinctes, échéancier et remboursements contrôlés",async()=>{
   await record(contract);await record(schedule);await record(disbursement);
   await assert.rejects(deposit({...disbursement,reference:"TR-2",amount:"700"}),{status:409});
   await assert.rejects(deposit({...disbursement,reference:"tr-1"}),{status:409});
   await record({...disbursement,reference:"TR-2",beneficiaryType:"CLIENT",beneficiary:"Client fictif"});
   await assert.rejects(deposit({...payment,installmentReference:"UNKNOWN"}),{status:409});paymentId=await record(payment);
   const facts=effectiveLoanFacts((await service.loanCase("owner","case")).loans[0].events);
   assert.equal(facts.filter(f=>f.data.kind==="DISBURSEMENT").length,2);
   const paid=facts.find(f=>f.data.kind==="PAYMENT")?.data;assert.equal(paid?.kind==="PAYMENT"&&paid.amount,"100");
  });
  await t.test("Corrections immuables : montants, dépendances, anciennes versions et conflits",async()=>{
   await assert.rejects(deposit({...decision,amount:"500"},oldDecision),{status:409});
   const before=await db.loanEvent.findUniqueOrThrow({where:{id:paymentId}}),v=await version();
   const correction=await deposit({...payment,amount:"90",reason:"Correction de montant sur relevé signé"},paymentId);
   await assert.rejects(service.reviewLoanEvent("reviewer",{id:correction.id,version:v,decision:"ACCEPTED",sourceChecked:true,reason:"Contrôle après modification concurrente"}),{status:409});
   await review(correction.id);assert.deepEqual(await db.loanEvent.findUniqueOrThrow({where:{id:paymentId}}),before);
   await assert.rejects(deposit(payment,paymentId),{status:409});
   const facts=effectiveLoanFacts((await service.loanCase("owner","case")).loans[0].events);assert.equal(facts.filter(f=>f.data.kind==="PAYMENT").length,1);assert.equal(facts.find(f=>f.data.kind==="PAYMENT")?.id,correction.id);
   const scheduleId=facts.find(f=>f.data.kind==="SCHEDULE")!.id;
   await assert.rejects(deposit({...schedule,rows:[{reference:"M02",date:"2026-03-01",amount:"100"}]},scheduleId),{status:409});
  });
  await t.test("Intégrité des preuves et retour motivé avant nouvelle saisie",async()=>{
   const e=await deposit({...payment,reference:"PAY-2",installmentReference:"M02"});const doc=await db.loanEvent.findUniqueOrThrow({where:{id:e.id}}),path=join(root,"documents/loans",doc.storageKey);
   writeFileSync(path,"modified");await assert.rejects(review(e.id),{status:409});await assert.rejects(service.readLoanProof("owner",e.id),{status:409});
   writeFileSync(path,bytes);await review(e.id,"REJECTED");await record({...payment,reference:"PAY-2",installmentReference:"M02"});
  });
  await t.test("Clôture du prêt distincte du juridique, refus des nouvelles opérations et sauvegarde des preuves",async()=>{
   await record({...common,kind:"CLOSURE",reference:"CLOSE-1",eventDate:"2026-04-01",receivedDate:"2026-04-02",conditions:"Décompte final et confirmation du prêteur examinés"});
   await assert.rejects(deposit({...payment,reference:"PAY-3"}),{status:409});
   assert.equal((await db.financeCase.findUniqueOrThrow({where:{id:"case"}})).status,"INTERNALLY_VALIDATED");assert.equal(await db.legalRecord.count(),0);
   const {createBackup,verifyBackup,restoreBackup}=await import("../scripts/backup");
   const backup=await createBackup(join(root,"db"),join(root,"documents"),join(root,"backup"));assert.equal(backup.documents,await db.loanEvent.count());
   const verified=await verifyBackup(join(root,"backup"));assert.ok(verified.documents.every(d=>d.path.startsWith("loans/")));await restoreBackup(join(root,"backup"),join(root,"restored"));
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
test("Prêts : validation des dates, devises exactes et références d’échéances",()=>{
 assert.equal(loanDataSchema.safeParse({...decision,eventDate:"2026-02-30"}).success,false);
 assert.equal(loanDataSchema.safeParse({...decision,amount:"10.123"}).success,false);
 assert.equal(loanDataSchema.safeParse({...decision,outcome:"REFUSED",amount:"100"}).success,false);
 assert.equal(loanDataSchema.safeParse({...schedule,rows:[schedule.rows[0],schedule.rows[0]]}).success,false);
 assert.equal(loanDataSchema.safeParse({...schedule,effectiveDate:"2099-01-01"}).success,false);
 const facts=(values:LoanData[])=>values.map((data,i)=>({id:String(i),status:"ACCEPTED",replacesId:null,data}));
 assert.throws(()=>validateLoanFacts(facts([decision,{...contract,amount:"1200.01"}])));
 assert.throws(()=>validateLoanFacts(facts([{...decision,outcome:"CONDITIONAL"},contract])));
});
