import { z } from "zod";
export const publicationStates:Record<string,string>={DRAFT:"Brouillon",IN_REVIEW:"À relire",PUBLISHED:"Publié",WITHDRAWN:"Retiré",ARCHIVED:"Archivé"};
export const publicationAudiences={MEMBERS:"Tous les membres",ACQUIRER:"Un acquéreur",PARCEL:"Une parcelle"};
export const publicationContent=z.object({
 title:z.string().trim().min(3,"Indiquez un titre d’au moins 3 caractères.").max(160),
 body:z.string().trim().min(10,"Rédigez un contenu d’au moins 10 caractères.").max(10000),
 audience:z.enum(["MEMBERS","ACQUIRER","PARCEL"]),
 targetReference:z.string().trim().max(100),
}).strict().superRefine((v,ctx)=>{
 if(v.audience!=="MEMBERS"&&!v.targetReference)ctx.addIssue({code:"custom",path:["targetReference"],message:"Indiquez la référence du destinataire."});
 if(v.audience==="MEMBERS"&&v.targetReference)ctx.addIssue({code:"custom",path:["targetReference"],message:"Une actualité générale ne peut pas cibler un destinataire."});
});
export type PublicationContent=z.infer<typeof publicationContent>;
