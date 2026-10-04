import { z } from "zod";
import { minorUnits,currencies } from "./finance-model";
export const incidentCategories={PAYMENT:"Paiement",FEES:"Frais",BANK:"Banque",DATA:"Données",CONFLICT:"Conflit",WORKS:"Travaux",OTHER:"Autre"};
export const incidentUrgencies={ORDINARY:"Réclamation ordinaire",FRAUD:"Fraude possible",DATA_EXPOSURE:"Données exposées",INTERRUPTED:"Activité interrompue"};
export const incidentStates={RECEIVED:"Reçu",ANALYSIS:"En analyse",WAITING:"Attente externe",RESOLVED:"Résolu",CONTESTED:"Contesté",ESCALATED:"Escaladé",CLOSED:"Clôturé"};
export type IncidentState=keyof typeof incidentStates;
export const incidentTransitions:Record<IncidentState,IncidentState[]>={RECEIVED:["ANALYSIS","ESCALATED"],ANALYSIS:["WAITING","RESOLVED","ESCALATED"],WAITING:["ANALYSIS","RESOLVED","ESCALATED"],RESOLVED:["CLOSED","CONTESTED"],CONTESTED:["ANALYSIS","ESCALATED"],ESCALATED:["ANALYSIS","WAITING","RESOLVED"],CLOSED:["CONTESTED"]};
const text=(max:number)=>z.string().trim().max(max);
const date=z.union([z.literal(""),z.iso.date()]);
export const incidentCreateSchema=z.object({
 caseId:text(100),title:text(160).min(5),channel:z.enum(["PHONE","EMAIL","IN_PERSON","INTERNAL","OTHER"]),reporter:text(160).min(2),contact:text(300),category:z.enum(["PAYMENT","FEES","BANK","DATA","CONFLICT","WORKS","OTHER"]),project:text(500),description:text(5000).min(10),evidence:text(2000),amount:text(15).refine(v=>{if(!v)return true;try{minorUnits(v);return true;}catch{return false;}},"Montant invalide."),currency:z.enum(currencies),urgency:z.enum(["ORDINARY","FRAUD","DATA_EXPOSURE","INTERRUPTED"]),immediateMeasure:text(2000),ownerId:text(100).min(1),implicatedUserId:text(100),
}).strict();
export const incidentProgressSchema=z.object({immediateMeasure:text(2000),externalContact:text(300),firstResponse:text(2000),acknowledgedOn:date,dueOn:date,findings:text(4000),correction:text(4000),decision:text(2000),clientResponse:text(4000),respondedOn:date,prevention:text(2000)}).strict();
export type IncidentInput=z.infer<typeof incidentCreateSchema>;
export type IncidentProgress=z.infer<typeof incidentProgressSchema>;
export type IncidentData={initial:Omit<IncidentInput,"ownerId"|"implicatedUserId"|"caseId">;implicatedName:string;progress:IncidentProgress};
export const emptyProgress:IncidentProgress={immediateMeasure:"",externalContact:"",firstResponse:"",acknowledgedOn:"",dueOn:"",findings:"",correction:"",decision:"",clientResponse:"",respondedOn:"",prevention:""};
export const progressLabels:Record<keyof IncidentProgress,string>={immediateMeasure:"Mesure immédiate et auteur",externalContact:"Institution ou professionnel à saisir",firstResponse:"Premier retour et délai annoncé",acknowledgedOn:"Date du premier retour",dueOn:"Prochaine échéance",findings:"Constat vérifié",correction:"Correction apportée",decision:"Décision et autorisation requise",clientResponse:"Réponse au déclarant consignée",respondedOn:"Date de la réponse",prevention:"Prévention"};
export const incidentChannels={PHONE:"Téléphone",EMAIL:"E-mail",IN_PERSON:"Sur place",INTERNAL:"Signalement interne",OTHER:"Autre"};
