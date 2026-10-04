import { z } from "zod";
import { db } from "./db";
import { WorkflowError } from "./workflow";
const profileSchema=z.object({
 fileId:z.string().min(1).optional(),
 version:z.number().int().nonnegative(),
 phone:z.string().trim().min(7,"Indiquez votre numéro de téléphone.").max(30).regex(/^[+0-9(). \-]+$/,"Vérifiez le numéro de téléphone.").refine(v=>v.replace(/\D/g,"").length>=6,"Vérifiez le numéro de téléphone."),
 city:z.string().trim().min(2,"Indiquez votre ville.").max(100),
 country:z.string().trim().min(2,"Indiquez votre pays.").max(100),
}).strict();
export async function updateProfile(userId:string,input:unknown){
 const v=profileSchema.parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});
  if(!actor?.active||actor.role!=="ACQUIRER")throw new WorkflowError("Accès réservé à votre profil acquéreur.",403);
  if(!v.fileId&&await tx.acquirerFile.count({where:{acquirer:{userId}}})>1)throw new WorkflowError("Rechargez le formulaire pour choisir le dossier à modifier.",409);
  const file=await tx.acquirerFile.findFirst({where:{id:v.fileId??actor.selectedFileId??undefined,acquirer:{userId}}});if(!file)throw new WorkflowError("Profil inaccessible.",404);
  if(file.version!==v.version)throw new WorkflowError("Votre dossier a changé. Rechargez la page avant d’enregistrer.",409);
  const before={phone:file.phone,city:file.city,country:file.country};const after={phone:v.phone,city:v.city,country:v.country};
  if(JSON.stringify(before)===JSON.stringify(after))return {success:true,changed:false};
  const changed=await tx.acquirerFile.updateMany({where:{id:file.id,version:v.version},data:{...after,version:{increment:1}}});
  if(changed.count!==1)throw new WorkflowError("Votre dossier a changé. Rechargez la page avant d’enregistrer.",409);
  await tx.auditEvent.create({data:{actorId:userId,objectId:file.id,action:"PROFILE_UPDATED",detail:JSON.stringify({before,after,version:v.version+1})}});
  return {success:true,changed:true};
 });
}
