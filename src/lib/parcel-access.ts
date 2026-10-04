import {z} from "zod";
import {db} from "./db";
import {WorkflowError,verifyParcelAccess} from "./workflow";
import {accessVerification} from "./parcel-access-model";
export async function manageParcelAccess(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),version:z.number().int().nonnegative(),action:z.enum(["REVOKE","RENEW","REEXAMINE"]),reason:z.string().trim().min(10).max(1000),access:accessVerification.optional()}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Action réservée à l’équipe acquéreurs.",403);
  const declaration=await tx.parcelDeclaration.findUnique({where:{id:v.id},include:{file:true}});
  if(!declaration||declaration.status!=="APPROVED"||!declaration.parcelId||declaration.file.version!==v.version)throw new WorkflowError("Le rattachement a changé ou n’est pas validé.",409);
  if(v.action==="REVOKE"&&declaration.accessRevokedAt)throw new WorkflowError("Cet accès est déjà retiré.",409);
  if(v.action==="RENEW"&&!v.access)throw new WorkflowError("Vérifiez les justificatifs et les droits avant de renouveler.");
  const permission=v.action==="RENEW"?await verifyParcelAccess(tx,declaration.id,declaration.parcelId,v.access):null;
  const changed=await tx.acquirerFile.updateMany({where:{id:declaration.fileId,version:v.version},data:{version:{increment:1}}});if(changed.count!==1)throw new WorkflowError("Le dossier a changé. Rechargez la page.",409);
  if(v.action==="REEXAMINE"){
   await tx.parcelDeclaration.update({where:{id:declaration.id},data:{status:"PENDING",accessRevokedAt:new Date(),reason:v.reason}});
   await tx.acquirerFile.update({where:{id:declaration.fileId},data:{status:"NEEDS_INFO"}});
   await tx.auditEvent.create({data:{actorId:userId,objectId:declaration.fileId,action:"PARCEL_ACCESS_REEXAMINE",detail:JSON.stringify({reference:declaration.reference,reason:v.reason,before:{...declaration,file:undefined}})}});return {success:true};
  }
  const updated=await tx.parcelDeclaration.update({where:{id:declaration.id},data:v.action==="REVOKE"?{accessRevokedAt:new Date()}:{accessRevokedAt:null,accessExpiresAt:permission!.expiresAt,accessVerification:permission!.record}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:declaration.fileId,action:`PARCEL_ACCESS_${v.action}`,detail:JSON.stringify({declarationId:declaration.id,reference:declaration.reference,reason:v.reason,before:{verification:declaration.accessVerification,expiresAt:declaration.accessExpiresAt,revokedAt:declaration.accessRevokedAt},after:{verification:updated.accessVerification,expiresAt:updated.accessExpiresAt,revokedAt:updated.accessRevokedAt}})}});
  return {success:true};
 });
}
