import { z } from "zod";
export const informationScopes = { IDENTITY:"Identité et contacts", INCOME:"Revenus et charges", LAND:"Terrain et projet", BUDGET:"Budget et plan de financement", OTHER:"Autres pièces expressément nommées" } as const;
export const authorizationStates:Record<string,string>={DRAFT:"Brouillon",READY_FOR_SIGNATURE:"Préparée pour signature",WITHDRAWN:"Retirée"};
export const authorizationSchema=z.object({
 institutionId:z.string().min(1,"Choisissez une institution."),controllerEntity:z.string().trim().min(2).max(200),recipientService:z.string().trim().min(2).max(200),purpose:z.string().trim().min(10,"Précisez la finalité (10 caractères minimum).").max(2000),
 scopes:z.array(z.enum(["IDENTITY","INCOME","LAND","BUDGET","OTHER"])).min(1,"Choisissez les informations concernées.").max(5).refine(a=>new Set(a).size===a.length),
 documentIds:z.array(z.string().min(1)).max(50).refine(a=>new Set(a).size===a.length),
 startsOn:z.iso.date(),endsOn:z.iso.date(),endEvent:z.string().trim().max(500),stopContact:z.string().trim().min(5).max(300),noticeVersion:z.string().trim().min(1).max(160),
}).strict().superRefine((v,ctx)=>{if(v.endsOn<v.startsOn)ctx.addIssue({code:"custom",path:["endsOn"],message:"La fin doit suivre le début de la période."});if(v.scopes.includes("OTHER")&&!v.documentIds.length)ctx.addIssue({code:"custom",path:["documentIds"],message:"Nommez les autres pièces en les sélectionnant."});});
export type AuthorizationInput=z.infer<typeof authorizationSchema>;
export type AuthorizationPayload={input:AuthorizationInput;caseReference:string;applicantName:string;cycle:number;institution:{id:string;name:string;branch:string;address:string};documents:{id:string;label:string;name:string;revision:number;sha256:string}[];information:{label:string;reference:string;values:Record<string,string>}[]};
export function authorizationPeriod(input:Pick<AuthorizationInput,"startsOn"|"endsOn">,today=new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Kinshasa"})){return today>input.endsOn?"Période expirée":today<input.startsOn?"Période à venir":"Période en cours";}
