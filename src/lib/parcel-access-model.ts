import {z} from "zod";
import {readIdentity,readParcel} from "./dossier-model";
export const accessQualities={HOLDER:"Titulaire",COHOLDER:"Cotitulaire",REPRESENTATIVE:"Représentant"};
export const accessVerification=z.object({quality:z.enum(["HOLDER","COHOLDER","REPRESENTATIVE"]),proofId:z.string().min(1,"Choisissez la pièce justifiant les droits."),principal:z.string().trim().max(200),expiresOn:z.union([z.literal(""),z.iso.date()]),checked:z.literal(true,{error:"Confirmez la vérification des droits."}),sharedChecked:z.boolean()}).strict();
export type AccessVerification=z.infer<typeof accessVerification>;
export function declaredQuality(identity:unknown,parcel:unknown){const kinds=[readIdentity(identity).quality,readParcel(parcel).quality];return kinds.includes("REPRESENTATIVE")?"REPRESENTATIVE":kinds.includes("COHOLDER")?"COHOLDER":"HOLDER";}
export function activeParcelWhere(now=new Date()){return {status:"APPROVED",accessRevokedAt:null,OR:[{accessExpiresAt:null},{accessExpiresAt:{gt:now}}]};}
export function accessStatus(p:{status:string;accessRevokedAt:Date|null;accessExpiresAt:Date|null},now=new Date()){return p.status!=="APPROVED"?p.status:p.accessRevokedAt?"ACCESS_REVOKED":p.accessExpiresAt&&p.accessExpiresAt<=now?"ACCESS_EXPIRED":"APPROVED";}
