import { z } from "zod";
import { currencies,minorUnits } from "./finance-model";
const text=(max:number)=>z.string().trim().max(max);
const date=z.union([z.literal(""),z.iso.date()]);
export const institutionSchema=z.object({name:text(160).min(2,"Indiquez l’entité exacte."),branch:text(160),contactName:text(160),contactRole:text(120),email:z.union([z.literal(""),z.email()]),phone:text(40),address:text(500),notes:text(2000)}).strict();
export type InstitutionInput=z.infer<typeof institutionSchema>;
export const rateMethods={UNKNOWN:"À préciser",DECLINING:"Capital restant dû",FLAT:"Taux forfaitaire",OTHER:"Autre méthode"};
export const offerFields={
 eligibility:"Produit, clients et zone admissibles",security:"Apport, garanties, assurance et revenus exigés",pricing:"Taux, frais, TEG et coût total communiqués",schedule:"Échéancier, différé et dernière échéance",disbursement:"Conditions de déblocage et bénéficiaires",defaultTerms:"Retard, défaut et remboursement anticipé",requiredDocuments:"Pièces requises et délai après complétude",confirmations:"Relevés, références et confirmations",complaints:"Réclamations, secours et sécurité",kipcityTerms:"Conditions Kip-City et validité",commission:"Commission, exclusivité et contrepartie",support:"Garantie ou mécanisme de soutien envisagé",internalNotes:"Évaluation interne et réserves",
};
const amount=z.union([z.literal(""),z.string().trim().refine(v=>{try{minorUnits(v);return true;}catch{return false;}},"Montant invalide.")]);
export const offerSchema=z.object({product:text(160).min(2,"Indiquez le produit ou l’objet de l’offre."),amount,currency:z.enum(currencies),durationMonths:z.union([z.literal(""),z.string().regex(/^\d{1,4}$/,"Durée en mois entiers.").refine(v=>Number(v)>0,"La durée doit être positive.")]),responseDate:date,validUntil:date,author:text(160),writtenReference:text(200),documentId:text(100),rateMethod:z.enum(["UNKNOWN","DECLINING","FLAT","OTHER"]),eligibility:text(2000),security:text(2000),pricing:text(2000),schedule:text(2000),disbursement:text(2000),defaultTerms:text(2000),requiredDocuments:text(2000),confirmations:text(2000),complaints:text(2000),kipcityTerms:text(2000),commission:text(2000),support:text(2000),internalNotes:text(4000)}).strict().refine(v=>!v.validUntil||!v.responseDate||v.validUntil>=v.responseDate,{message:"La fin de validité ne peut pas précéder la réponse.",path:["validUntil"]});
export type OfferInput=z.infer<typeof offerSchema>;
export function offerValidity(value:OfferInput,today=new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Kinshasa"})){
 return !value.validUntil?"Validité à préciser":value.validUntil<today?"Date de validité dépassée":"Dans la période indiquée";
}
