import {z} from "zod";
const text=(max=160)=>z.string().trim().max(max).default("");
const date=z.string().refine(v=>v===""||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),"Indiquez une date valide.").default("");
export const qualities={HOLDER:"Titulaire",COHOLDER:"Cotitulaire",REPRESENTATIVE:"Représentant à vérifier"} as const;
export const identityDetails=z.object({
 quality:z.enum(["HOLDER","COHOLDER","REPRESENTATIVE"]).default("HOLDER"),
 lastName:text(120),postName:text(120),firstNames:text(120),holderName:text(200),birthDate:date,birthPlace:text(),nationality:text(100),profession:text(),maritalStatus:text(100),address:text(500),region:text(100),postalCode:text(30),contactPreference:z.enum(["EMAIL","PHONE"]).default("EMAIL"),observation:text(2000),
}).strict();
export const parcelDetails=z.object({cadastralReference:text(120),phase:text(100),block:text(100),location:text(300),area:text(40),dimensions:text(100),holders:text(1000),quality:z.enum(["HOLDER","COHOLDER","REPRESENTATIVE"]).default("HOLDER"),referenceUnknown:z.boolean().default(false),missingContract:z.boolean().default(false),observation:text(2000)}).strict();
export const contractTypes={ACQUISITION:"Contrat d’acquisition Kip-City",LEASE:"Contrat de location foncière",LAND_ACT:"Autre acte foncier",AMENDMENT:"Avenant ou renouvellement",PLAN:"Plan cadastral",REPORT:"Constat des lieux",MANDATE:"Mandat de représentation",OTHER:"Autre pièce"} as const;
export const documentDetails=z.object({category:z.enum(["ACQUISITION","LEASE","LAND_ACT","AMENDMENT","PLAN","REPORT","MANDATE","OTHER"]),parcelReferences:z.array(z.string().trim().min(1).max(60)).min(1,"Sélectionnez au moins une parcelle.").max(10),reference:text(160),issuedOn:date,issuer:text(200),effectiveOn:date,duration:text(160),observation:text(2000)}).strict();
export function readIdentity(value:unknown){const p=identityDetails.safeParse(value);return p.success?p.data:identityDetails.parse({});}
export function readParcel(value:unknown){const p=parcelDetails.safeParse(value);return p.success?p.data:parcelDetails.parse({});}
export type IdentityDetails=z.infer<typeof identityDetails>;
export type ParcelDetails=z.infer<typeof parcelDetails>;
