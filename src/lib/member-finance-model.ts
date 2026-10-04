import { z } from "zod";
export const memberFinanceStages={RECEIVED:"Demande reçue",IN_PROGRESS:"Étude en cours",ACTION_REQUIRED:"Éléments à fournir",APPOINTMENT:"Rendez-vous prévu",COMPLETED:"Accompagnement terminé"};
export const memberUpdateSchema=z.object({
 title:z.string().trim().min(3).max(160),stage:z.enum(["RECEIVED","IN_PROGRESS","ACTION_REQUIRED","APPOINTMENT","COMPLETED"]),message:z.string().trim().min(10).max(3000),
 documents:z.array(z.object({label:z.string().trim().min(2).max(160),dueOn:z.union([z.literal(""),z.iso.date()])}).strict()).max(20),
 appointmentDate:z.union([z.literal(""),z.iso.date()]),appointmentTime:z.union([z.literal(""),z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),appointmentPlace:z.string().trim().max(300),contact:z.string().trim().max(300),
}).strict().superRefine((v,ctx)=>{
 if(v.stage==="ACTION_REQUIRED"&&!v.documents.length)ctx.addIssue({code:"custom",path:["documents"],message:"Ajoutez au moins un élément à fournir."});
 if(v.appointmentDate||v.appointmentTime||v.appointmentPlace||v.stage==="APPOINTMENT")if(!v.appointmentDate||!v.appointmentTime||!v.appointmentPlace)ctx.addIssue({code:"custom",path:["appointmentDate"],message:"Précisez la date, l’heure et le lieu ou le mode du rendez-vous."});
});
export type MemberUpdate=z.infer<typeof memberUpdateSchema>;
export const emptyMemberUpdate:MemberUpdate={title:"",stage:"IN_PROGRESS",message:"",documents:[],appointmentDate:"",appointmentTime:"",appointmentPlace:"",contact:""};
