import { z } from "zod";
import { currencies, minorUnits } from "./finance-model";
export const arrangements = { RENT: "Location", SHARE: "Partage", KIP_BUILDING: "Bâtiment Kip-City", SELF: "Opérateur finance seul", OTHER: "Autre montage à examiner" };
export const opportunityStates = { STUDY: "Étude", SEARCH: "Partenaire recherché", OFFER: "Offre conditionnelle", SIGNED: "Accord signé sous conditions", REFUSED: "Refus", DEFERRED: "Ajournement" };
export const costKinds = { STUDIES: "Études et formalités", BUILDING: "Bâtiment et aménagements", EQUIPMENT: "Équipements", RESERVE: "Trésorerie et réserve" };
export const resourceKinds = { KIP: "Kip-City", OPERATOR: "Opérateur ou investisseur", EXTERNAL: "Dette ou soutien externe" };
export const opportunityFields = { project: "Projet", operator: "Opérateur", entity: "Entité envisagée", location: "Emplacement et droit d’usage", arrangementNotes: "Précisions sur le montage", revenues: "Revenus et scénario prudent", assets: "Propriété des actifs et sort des constructions", remuneration: "Loyer, participation ou rémunération envisagée", reporting: "Compte, reporting et droit d’audit", interests: "Intérêts liés et décisions réservées", visas: "Visas nominatifs, dates et références des décisions" };
const text=z.string().trim().max(3000);
const amount=z.string().trim().refine(v=>{try{minorUnits(v);return true;}catch{return false;}},"Montant invalide (deux décimales maximum).");
const line={label:z.string().trim().min(1).max(300),amount,currency:z.enum(currencies),documentId:z.string().max(100)};
export const opportunitySchema=z.object({
 project:text,operator:text,entity:text,location:text,arrangement:z.enum(Object.keys(arrangements) as [keyof typeof arrangements,...(keyof typeof arrangements)[]]),arrangementNotes:text,
 costs:z.array(z.object({...line,category:z.enum(["STUDIES","BUILDING","EQUIPMENT","RESERVE"])}).strict()).max(40),
 resources:z.array(z.object({...line,source:z.enum(["KIP","OPERATOR","EXTERNAL"]),kind:z.enum(["CASH","IN_KIND"]),status:z.enum(["PROPOSED","DOCUMENTED"]),counterpart:text}).strict()).max(40),
 revenues:text,assets:text,remuneration:text,reporting:text,interests:text,visas:text,
 valuesChecked:z.boolean(),interestsChecked:z.boolean(),status:z.enum(["STUDY","SEARCH","OFFER","SIGNED","REFUSED","DEFERRED"]),
 financeDocumentId:z.string().max(100),legalDocumentId:z.string().max(100),decisionDocumentId:z.string().max(100),
}).strict().superRefine((v,ctx)=>{
 v.resources.forEach((r,i)=>{if(r.status==="DOCUMENTED"&&!r.documentId)ctx.addIssue({code:"custom",path:["resources",i,"documentId"],message:"Joignez la preuve de l’apport documenté."});});
 if(["OFFER","SIGNED"].includes(v.status)&&!v.decisionDocumentId)ctx.addIssue({code:"custom",path:["decisionDocumentId"],message:"Référencez l’offre ou l’accord externe."});
});
export type Opportunity=z.infer<typeof opportunitySchema>;
export const emptyOpportunity:Opportunity={project:"",operator:"",entity:"",location:"",arrangement:"RENT",arrangementNotes:"",costs:[],resources:[],revenues:"",assets:"",remuneration:"",reporting:"",interests:"",visas:"",valuesChecked:false,interestsChecked:false,status:"STUDY",financeDocumentId:"",legalDocumentId:"",decisionDocumentId:""};
export function opportunityDocuments(v:Opportunity){return [...v.costs,...v.resources].map(l=>l.documentId).concat(v.financeDocumentId,v.legalDocumentId,v.decisionDocumentId).filter(Boolean);}
export function opportunityReady(v:Opportunity){return !!(v.project&&v.operator&&v.entity&&v.location&&v.revenues&&v.assets&&v.remuneration&&v.reporting&&v.interests&&v.visas&&v.valuesChecked&&v.interestsChecked&&v.financeDocumentId&&v.legalDocumentId&&v.decisionDocumentId&&v.costs.length&&v.resources.length&&summarizeOpportunity(v).every(s=>s.complete)&&v.costs.every(l=>l.documentId)&&v.resources.every(l=>l.documentId&&l.counterpart)&&(v.arrangement!=="OTHER"||v.arrangementNotes));}
export function summarizeOpportunity(v:Opportunity){return currencies.flatMap(currency=>{
 const costs=v.costs.filter(l=>l.currency===currency),resources=v.resources.filter(l=>l.currency===currency);if(!costs.length&&!resources.length)return [];
 const sum=(lines:{amount:string}[])=>lines.reduce((a,l)=>a+minorUnits(l.amount),0n);
 const cost=sum(costs),cash=sum(resources.filter(l=>l.kind==="CASH")),inKind=sum(resources.filter(l=>l.kind==="IN_KIND"));
 return [{currency,cost,cash,inKind,need:cost-cash-inKind,complete:Object.keys(costKinds).every(k=>costs.some(l=>l.category===k))&&resources.length>0}];
});}
