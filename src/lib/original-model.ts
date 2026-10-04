import {z} from "zod";
export const originalKinds={DEPOSIT:"Remise initiale",TEMPORARY_OUT:"Sortie temporaire",RETURN_TO_CUSTODY:"Retour en garde",TRANSFER:"Transmission autorisée",FINAL_RETURN:"Restitution définitive",LOSS:"Perte signalée",DAMAGE:"Détérioration signalée",FOUND:"Pièce retrouvée"} as const;
export const originalStates={UNCONFIRMED:"Remise à contrôler",HELD:"En garde",OUT:"Sortie temporaire",LOST:"Perte constatée",RETURNED:"Restitué"} as const;
export const eventStates:Record<string,string>={PENDING:"À contrôler",ACCEPTED:"Contrôlé",REJECTED:"À corriger",CANCELLED:"Retiré du contrôle"};
const required=(max=2000)=>z.string().trim().min(1,"Complétez les champs obligatoires.").max(max);
const optional=z.string().trim().max(2000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,"Date invalide.");
export const originalInventory=z.object({nature:required(160),documentReference:required(160),issuer:required(300),documentDate:date,parcelReference:required(160),pages:z.number().int().min(1).max(10000),initialCondition:required(),depositor:required(),custodian:required(),basis:required(),authorizedPeople:required(),returnTerms:required(),incidentProcedure:required(),copyDelivered:z.literal(true),authenticityExamined:z.literal(true)}).strict();
export const originalData=z.object({kind:z.enum(["DEPOSIT","TEMPORARY_OUT","RETURN_TO_CUSTODY","TRANSFER","FINAL_RETURN","LOSS","DAMAGE","FOUND"]),occurredAt:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),place:required(500),holder:required(),location:required(500),condition:required(),authority:required(),receipt:required(300),signatories:required(),returnDue:date.or(z.literal("")),returnTerms:optional,transport:optional,discrepancies:required(),incidentReference:z.string().trim().max(160),reason:required(),inventory:originalInventory.optional()}).strict().superRefine((v,c)=>{
 const parsed=new Date(`${v.occurredAt}:00+01:00`);
 const valid=!Number.isNaN(parsed.getTime())&&new Date(parsed.getTime()+3600000).toISOString().slice(0,16)===v.occurredAt;
 if(!valid||parsed>new Date())c.addIssue({code:"custom",message:"Indiquez une date et une heure réelles, non futures (heure de Kinshasa)."});
 if(v.kind==="DEPOSIT"&&!v.inventory||v.kind!=="DEPOSIT"&&v.inventory)c.addIssue({code:"custom",message:"L’inventaire initial est requis uniquement pour la remise initiale."});
 if(v.inventory&&v.inventory.documentDate>v.occurredAt.slice(0,10))c.addIssue({code:"custom",message:"La pièce ne peut pas être postérieure à sa remise."});
 if(v.kind==="TEMPORARY_OUT"&&!v.returnDue&&!v.returnTerms)c.addIssue({code:"custom",message:"Précisez la date ou l’événement attendu pour le retour."});
 if(v.returnDue&&v.returnDue<v.occurredAt.slice(0,10))c.addIssue({code:"custom",message:"Le retour attendu ne peut pas précéder la sortie."});
});
export type OriginalData=z.infer<typeof originalData>;
export type OriginalFact={id:string;sequence:number;status:string;replacesId:string|null;data:unknown};
export function effectiveOriginalEvents(events:OriginalFact[]){const accepted=events.filter(e=>e.status==="ACCEPTED"),replaced=new Set(accepted.map(e=>e.replacesId));return accepted.filter(e=>!replaced.has(e.id)).sort((a,b)=>a.sequence-b.sequence).map(e=>({...e,data:originalData.parse(e.data)}));}
export function originalSituation(events:OriginalFact[]){
 const effective=effectiveOriginalEvents(events);let state:keyof typeof originalStates="UNCONFIRMED",last:OriginalData|undefined;
 for(const e of effective){const d=e.data;
  if(last&&d.occurredAt<last.occurredAt)throw new Error("Ce fait précède le dernier mouvement contrôlé. Faites corriger la chronologie par le Cabinet.");
  if(state==="UNCONFIRMED"&&d.kind!=="DEPOSIT"||state!=="UNCONFIRMED"&&d.kind==="DEPOSIT")throw new Error("La remise initiale doit être contrôlée avant les mouvements.");
  if(state==="RETURNED")throw new Error("Une pièce restituée n’accepte plus de mouvement.");
  if(state==="LOST"&&d.kind!=="FOUND")throw new Error("La pièce doit d’abord être retrouvée et son état contrôlé.");
  if(d.kind==="FOUND"&&state!=="LOST")throw new Error("Seule une pièce signalée perdue peut être déclarée retrouvée.");
  if(d.kind==="DAMAGE"&&last&&(d.holder!==last.holder||d.location!==last.location))throw new Error("Une détérioration ne change pas le détenteur ou le lieu de garde. Enregistrez le mouvement séparément.");
  if(d.kind==="TEMPORARY_OUT"&&state!=="HELD"||d.kind==="RETURN_TO_CUSTODY"&&state!=="OUT")throw new Error("Ce mouvement ne correspond pas à la situation de garde.");
  if(["DEPOSIT","TRANSFER","FOUND","RETURN_TO_CUSTODY"].includes(d.kind))state="HELD";
  if(d.kind==="TEMPORARY_OUT")state="OUT";
  if(d.kind==="FINAL_RETURN")state="RETURNED";
  if(d.kind==="LOSS")state="LOST";
  last=d;
 }
 const custody=[...effective].reverse().find(e=>e.data.kind!=="DAMAGE");
 return {state,last,effective,inventory:effective.find(e=>e.data.kind==="DEPOSIT")?.data.inventory,returnDue:state==="OUT"?custody?.data.returnDue:undefined,returnTerms:state==="OUT"?custody?.data.returnTerms:undefined};
}
