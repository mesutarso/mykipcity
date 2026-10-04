import {z} from "zod";
import {minorUnits} from "./finance-model";
export const loanKinds={DECISION:"Décision du prêteur",CONTRACT:"Contrat signé",SCHEDULE:"Échéancier du prêteur",DISBURSEMENT:"Décaissement constaté",PAYMENT:"Remboursement constaté",CLOSURE:"Clôture confirmée par le prêteur"} as const;
export const loanStatuses:Record<string,string>={PENDING:"À contrôler",ACCEPTED:"Contrôlé",REJECTED:"Écart à corriger"};
const text=(max=1000)=>z.string().trim().min(1,"Complétez les champs obligatoires.").max(max);
export const loanDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,"Date invalide.");
const amount=z.string().trim().refine(v=>{try{return minorUnits(v)>0n;}catch{return false;}},"Saisissez un montant supérieur à zéro, avec deux décimales maximum.");
const common={reference:text(160),documentVersion:text(80),eventDate:loanDate,receivedDate:loanDate,source:text(500),reason:text(2000)};
export const loanDataSchema=z.discriminatedUnion("kind",[
 z.object({...common,kind:z.literal("DECISION"),outcome:z.enum(["AGREED","CONDITIONAL","REFUSED"]),amount:amount.or(z.literal("")),conditions:text(4000)}).strict(),
 z.object({...common,kind:z.literal("CONTRACT"),amount,offerReference:text(160),parties:text(1000),conditions:text(4000)}).strict(),
 z.object({...common,kind:z.literal("SCHEDULE"),effectiveDate:loanDate,rows:z.array(z.object({reference:text(80),date:loanDate,amount}).strict()).min(1).max(600)}).strict(),
 z.object({...common,kind:z.literal("DISBURSEMENT"),amount,valueDate:loanDate,beneficiaryType:z.enum(["CLIENT","SUPPLIER","PLATFORM"]),beneficiary:text(500),conditions:text(4000)}).strict(),
 z.object({...common,kind:z.literal("PAYMENT"),amount,valueDate:loanDate,installmentReference:text(80),payer:text(500)}).strict(),
 z.object({...common,kind:z.literal("CLOSURE"),conditions:text(4000)}).strict(),
]).superRefine((v,ctx)=>{
 const today=new Date().toISOString().slice(0,10);
 if(v.eventDate>today||v.receivedDate>today||v.receivedDate<v.eventDate)ctx.addIssue({code:"custom",message:"Les dates du fait et de réception doivent être passées, dans cet ordre."});
 if((v.kind==="PAYMENT"||v.kind==="DISBURSEMENT")&&v.valueDate>today)ctx.addIssue({code:"custom",message:"La date de valeur ne peut pas être future."});
 if(v.kind==="DECISION"&&v.outcome!=="REFUSED"&&!v.amount)ctx.addIssue({code:"custom",message:"Précisez le montant de l’accord."});
 if(v.kind==="DECISION"&&v.outcome==="REFUSED"&&v.amount)ctx.addIssue({code:"custom",message:"Un refus ne comporte pas de montant accordé."});
 if(v.kind==="SCHEDULE"&&new Set(v.rows.map(r=>r.reference)).size!==v.rows.length)ctx.addIssue({code:"custom",message:"Chaque échéance doit avoir une référence distincte."});
 if(v.kind==="SCHEDULE"&&v.effectiveDate>today)ctx.addIssue({code:"custom",message:"Un échéancier futur doit être enregistré à sa date d’effet."});
});
export type LoanData=z.infer<typeof loanDataSchema>;
export type LoanFact={id:string;status:string;replacesId:string|null;data:unknown};
export function effectiveLoanFacts(events:LoanFact[]){
 const accepted=events.filter(e=>e.status==="ACCEPTED"),replaced=new Set(accepted.map(e=>e.replacesId).filter(Boolean));
 return accepted.filter(e=>!replaced.has(e.id)).map(e=>({...e,data:loanDataSchema.parse(e.data)}));
}
// Validate the whole effective register, including when correcting an earlier fact.
export function validateLoanFacts(events:LoanFact[]){
 const facts=effectiveLoanFacts(events),get=(kind:LoanData["kind"])=>facts.filter(f=>f.data.kind===kind);
 for(const kind of ["DECISION","CONTRACT","SCHEDULE","CLOSURE"] as const)if(get(kind).length>1)throw new Error("Ce fait existe déjà. Enregistrez une correction de sa dernière version.");
 const decision=get("DECISION")[0]?.data,contract=get("CONTRACT")[0]?.data,schedule=get("SCHEDULE")[0]?.data,closure=get("CLOSURE")[0]?.data;
 if(contract?.kind==="CONTRACT"){
  if(decision?.kind!=="DECISION"||decision.outcome!=="AGREED")throw new Error("Un accord documenté et contrôlé du prêteur est requis avant le contrat.");
  if(minorUnits(contract.amount)>minorUnits(decision.amount)||contract.eventDate<decision.eventDate)throw new Error("Le contrat doit correspondre au montant et à la date de l’accord contrôlé.");
 }
 const transactions=facts.filter(f=>["DISBURSEMENT","PAYMENT"].includes(f.data.kind));
 if((schedule||closure||transactions.length)&&contract?.kind!=="CONTRACT")throw new Error("Enregistrez et faites contrôler le contrat signé avant son suivi.");
 const references=new Set<string>();
 for(const fact of transactions){const d=fact.data,key=`${d.kind}:${d.reference.toLocaleUpperCase("fr")}`;if(references.has(key))throw new Error("Cette référence d’opération est déjà enregistrée.");references.add(key);}
 if(contract?.kind==="CONTRACT"){
  const disbursed=get("DISBURSEMENT").reduce((s,f)=>s+(f.data.kind==="DISBURSEMENT"?minorUnits(f.data.amount):0n),0n);
  if(disbursed>minorUnits(contract.amount))throw new Error("Les décaissements dépasseraient le montant du contrat. Vérifiez les preuves ou son avenant.");
  if(transactions.some(f=>f.data.eventDate<contract.eventDate)||(schedule&&schedule.eventDate<contract.eventDate)||(closure&&closure.eventDate<contract.eventDate))throw new Error("Le fait est antérieur au contrat signé.");
 }
 for(const p of get("PAYMENT")){const payment=p.data;if(payment.kind==="PAYMENT"&&(schedule?.kind!=="SCHEDULE"||!schedule.rows.some(r=>r.reference===payment.installmentReference)))throw new Error("Rattachez chaque remboursement à une échéance du prêteur. Conservez les références déjà utilisées lors d’un avenant.");}
 if(closure&&facts.some(f=>f.data.kind!=="CLOSURE"&&f.data.eventDate>closure.eventDate))throw new Error("La clôture est antérieure à un fait enregistré.");
 return facts;
}
