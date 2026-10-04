import { z } from "zod";
export const documentCategories={CONTRACT:"Contrat",LEASE:"Bail administratif",PLAN:"Plan cadastral",IDENTITY:"Identité",REPORT:"Rapport",CERTIFICATE:"Attestation",MANDATE:"Mandat de représentation",OTHER:"Autre pièce"};
export const documentStatuses:Record<string,string>={PENDING:"À examiner",ACCEPTED:"Pièce acceptée",NEEDS_INFO:"À compléter",DELIVERED:"Remis par l’équipe"};
export const memberDocumentSchema=z.object({
 fileId:z.string().min(1),title:z.string().trim().min(3).max(160),category:z.enum(["CONTRACT","LEASE","PLAN","IDENTITY","REPORT","CERTIFICATE","MANDATE","OTHER"]),
 parcelReferences:z.array(z.string().min(1).max(100)).max(10),direction:z.enum(["REQUESTED","RECEIVED"]),instructions:z.string().trim().max(2000),
}).strict();
