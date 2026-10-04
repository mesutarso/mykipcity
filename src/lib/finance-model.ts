import { z } from "zod";
export const currencies = ["USD", "CDF", "EUR"] as const;
export const pathways = { HABITAT: "Acquéreur / habitat", CVPSC: "CVPSC / exploitation", CATALOGUE: "Catalogue / partenariat" };
export const qualities = { VERIFIED: "Acquéreur vérifié", CANDIDATE: "Candidat", REPRESENTATIVE: "Représentant", OPERATOR: "Opérateur" };
export const needs = { HABITAT: "Habitat / PMV", CVPSC: "Service CVPSC", PROFESSIONAL: "Activité professionnelle", CATALOGUE: "Catalogue", OTHER: "Autre besoin" };
export const situations = { NONE: "Aucun contact bancaire", USUAL_BANK: "Banque habituelle à consulter", OFFER: "Offre reçue", ONGOING: "Financement en cours" };
export const categories = {
  REGULAR: "Revenus nets réguliers", VARIABLE: "Revenus variables prudents", ESSENTIAL: "Charges essentielles",
  DEBT: "Remboursements existants", COMMITMENT: "Autres engagements et cautions",
  WORKS: "Travaux ou services", FEES: "Formalités, taxes et honoraires", FINANCING: "Financement et assurance",
  PROVISION: "Provision technique", RESOURCES: "Apport et ressources acquises", INSTALLMENT: "Nouvelle échéance",
};
export type Category = keyof typeof categories;
export const periods = { MONTH: "Par mois", YEAR: "Par an", ONCE: "Ponctuel" };
export const proofs = { UNKNOWN: "À documenter", ESTIMATED: "Estimé", DOCUMENTED: "Justificatif référencé" };
// Integer cents only; no floating point and no conversion across currencies.
export function minorUnits(value: string): bigint {
  const normal = value.trim().replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(normal)) throw new Error("Montant invalide : 12 chiffres et 2 décimales maximum.");
  const [whole, fraction=""] = normal.split(".");
  return BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));
}
export function money(value: bigint, currency: string): string {
  const sign=value<0n?"−":"";const absolute=value<0n?-value:value;
  return `${sign}${(absolute/100n).toLocaleString("fr-FR")},${(absolute%100n).toString().padStart(2,"0")} ${currency}`;
}
const amount = z.string().trim().refine(v=>{try{minorUnits(v);return true;}catch{return false;}},"Saisissez un montant positif avec deux décimales maximum.");
const optionalAmount = z.union([z.literal(""),amount]);
const currency = z.enum(currencies);
const text = (max:number) => z.string().trim().max(max);
const date = z.union([z.literal(""),z.iso.date()]);
export const requestSchema = z.object({
  applicantName:text(160).min(2,"Indiquez le nom du demandeur."), quality:z.enum(["VERIFIED","CANDIDATE","REPRESENTATIVE","OPERATOR"]),
  acquirerReference:text(60),phone:text(30),email:z.union([z.literal(""),z.email()]),
  pathway:z.enum(["HABITAT","CVPSC","CATALOGUE"]),need:z.enum(["HABITAT","CVPSC","PROFESSIONAL","CATALOGUE","OTHER"]),
  otherNeed:text(300),project:text(1000),description:text(4000),calendar:text(300),
  projectCost:optionalAmount,projectCurrency:currency,contribution:optionalAmount,contributionCurrency:currency,
  requested:optionalAmount,requestedCurrency:currency,situation:z.enum(["NONE","USUAL_BANK","OFFER","ONGOING"]),
  institution:text(200),contact:text(200),nextContact:date,initialDocuments:text(1500),
}).strict().superRefine((v,ctx)=>{
  if(v.quality==="VERIFIED"&&!v.acquirerReference)ctx.addIssue({code:"custom",path:["acquirerReference"],message:"Indiquez la référence de l’acquéreur vérifié."});
  if(v.need==="OTHER"&&!v.otherNeed)ctx.addIssue({code:"custom",path:["otherNeed"],message:"Précisez le besoin."});
});
export const budgetSchema = z.object({
  situationDate:date,dependents:z.number().int().min(0).max(100),
  lines:z.array(z.object({category:z.enum(Object.keys(categories) as [Category,...Category[]]),amount,currency,period:z.enum(["MONTH","YEAR","ONCE"]),proof:z.enum(["UNKNOWN","ESTIMATED","DOCUMENTED"]),evidence:text(500),stability:text(500)}).strict()).min(1).max(40),
  installmentSource:text(1500),stressScenario:text(2500),risks:text(2500),analystNotes:text(4000),
}).strict().superRefine((v,ctx)=>{
  v.lines.forEach((line,i)=>{
    if(line.proof==="DOCUMENTED"&&!line.evidence)ctx.addIssue({code:"custom",path:["lines",i,"evidence"],message:"Référencez le justificatif de la ligne documentée."});
    if(["WORKS","FEES","FINANCING","PROVISION","RESOURCES"].includes(line.category)&&line.period!=="ONCE")ctx.addIssue({code:"custom",path:["lines",i,"period"],message:"Les montants du projet doivent être ponctuels."});
  });
});
export type FinanceRequest = z.infer<typeof requestSchema>;
export type FinanceBudget = z.infer<typeof budgetSchema>;
export function summarizeBudget(budget: FinanceBudget) {
  return currencies.flatMap(currency=>{
    const lines=budget.lines.filter(l=>l.currency===currency);if(!lines.length)return [];
    const total=(cats:Category[],period?:string)=>lines.filter(l=>cats.includes(l.category)&&(!period||l.period===period)).reduce((sum,l)=>sum+minorUnits(l.amount),0n);
    const monthly:Category[]=["REGULAR","VARIABLE","ESSENTIAL","DEBT","INSTALLMENT"];
    const complete=monthly.every(c=>lines.some(l=>l.category===c&&l.period==="MONTH"))&&!lines.some(l=>monthly.includes(l.category)&&l.period!=="MONTH");
    const projectComplete=(["WORKS","FEES","FINANCING","PROVISION","RESOURCES"] as Category[]).every(c=>lines.some(l=>l.category===c));
    const cost=total(["WORKS","FEES","FINANCING","PROVISION"]);const resources=total(["RESOURCES"]);
    return [{currency,cost,resources,costProvided:lines.some(l=>["WORKS","FEES","FINANCING","PROVISION"].includes(l.category)),resourcesProvided:lines.some(l=>l.category==="RESOURCES"),projectComplete,need:cost-resources,monthlyComplete:complete,remainder:total(["REGULAR","VARIABLE"],"MONTH")-total(["ESSENTIAL","DEBT","INSTALLMENT"],"MONTH")}];
  });
}
