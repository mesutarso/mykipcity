import {randomBytes} from "node:crypto";
import {verifyPassword} from "better-auth/crypto";
import {z} from "zod";
import {db} from "./db";
import {WorkflowError,tokenHash,getActor} from "./workflow";
import {queueMail} from "./mail";
export async function requestEmailChange(userId:string,input:unknown){
 const v=z.object({email:z.email().trim().toLowerCase().max(254),password:z.string().min(1).max(128)}).strict().parse(input);
 await getActor(userId);
 await db.$transaction(async tx=>{if(await tx.auditEvent.count({where:{actorId:userId,action:"EMAIL_CHANGE_ATTEMPT",createdAt:{gt:new Date(Date.now()-15*60000)}}})>=5)throw new WorkflowError("Trop de tentatives. Patientez quinze minutes.",429);await tx.auditEvent.create({data:{actorId:userId,objectId:userId,action:"EMAIL_CHANGE_ATTEMPT"}});});
 const actor=await getActor(userId),account=await db.account.findFirst({where:{userId,providerId:"credential"}});
 if(!account?.password||!await verifyPassword({hash:account.password,password:v.password}))throw new WorkflowError("Mot de passe incorrect.",403);
 if(actor.email===v.email)throw new WorkflowError("Cette adresse est déjà utilisée par votre compte.");
 return db.$transaction(async tx=>{
  const user=await tx.user.findUnique({where:{id:userId}}),credential=await tx.account.findUnique({where:{id:account.id}});
  if(!user?.active||user.email!==actor.email||credential?.password!==account.password)throw new WorkflowError("Le compte a changé. Reconnectez-vous.",409);
  if(await tx.emailChange.count({where:{userId,createdAt:{gt:new Date(Date.now()-60000)}}}))throw new WorkflowError("Patientez une minute avant de renouveler la demande.",429);
  if(await tx.user.findUnique({where:{email:v.email}})||await tx.acquirer.findUnique({where:{email:v.email}})||await tx.staffInvitation.findUnique({where:{email:v.email}}))throw new WorkflowError("Cette adresse ne peut pas être utilisée.",409);
  await tx.emailChange.updateMany({where:{userId,completedAt:null,cancelledAt:null},data:{cancelledAt:new Date()}});
  await tx.emailDelivery.updateMany({where:{userId,kind:"EMAIL_CHANGE",status:"PENDING"},data:{status:"CANCELLED",payload:""}});
  const oldToken=randomBytes(32).toString("hex"),newToken=randomBytes(32).toString("hex"),expiresAt=new Date(Date.now()+3600000);
  const change=await tx.emailChange.create({data:{userId,oldEmail:user.email,newEmail:v.email,oldTokenHash:tokenHash(oldToken),newTokenHash:tokenHash(newToken),accessVersion:user.accessVersion,expiresAt}});
  for(const [side,recipient,token] of [["old",user.email,oldToken],["new",v.email,newToken]])await queueMail({key:`email-change:${change.id}:${side}`,userId,recipient,kind:"EMAIL_CHANGE",subject:"Confirmer votre changement d’adresse Kip-City",text:`Une modification de votre adresse de connexion a été demandée. Les deux adresses doivent être confirmées.\n${process.env.BETTER_AUTH_URL}/confirmer-adresse?token=${token}\nSi vous n’êtes pas à l’origine de cette demande, ne confirmez pas et contactez l’équipe.`,expiresAt},tx);
  await tx.auditEvent.create({data:{actorId:userId,objectId:userId,action:"EMAIL_CHANGE_REQUESTED",detail:JSON.stringify({oldEmail:user.email,newEmail:v.email})}});
  return {success:true};
 });
}
export async function confirmEmailChange(input:unknown){
 const {token}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(input);const hash=tokenHash(token);
 return db.$transaction(async tx=>{
  const change=await tx.emailChange.findFirst({where:{OR:[{oldTokenHash:hash},{newTokenHash:hash}]}}),now=new Date();
  if(!change||change.cancelledAt||change.completedAt||change.expiresAt<=now)throw new WorkflowError("Lien expiré ou déjà utilisé.",410);
  const user=await tx.user.findUnique({where:{id:change.userId}});if(!user?.active||user.email!==change.oldEmail||user.accessVersion!==change.accessVersion)throw new WorkflowError("Le compte a changé. Renouvelez votre demande.",409);
  const oldConfirmed=change.oldConfirmed||change.oldTokenHash===hash,newConfirmed=change.newConfirmed||change.newTokenHash===hash;
  if(oldConfirmed&&newConfirmed){
   if(await tx.user.findUnique({where:{email:change.newEmail}})||await tx.acquirer.findUnique({where:{email:change.newEmail}})||await tx.staffInvitation.findUnique({where:{email:change.newEmail}}))throw new WorkflowError("Cette adresse ne peut plus être utilisée.",409);
   await tx.user.update({where:{id:user.id},data:{email:change.newEmail,emailVerified:true,accessVersion:{increment:1}}});
   await tx.acquirer.updateMany({where:{userId:user.id,email:change.oldEmail},data:{email:change.newEmail}});
   await tx.session.deleteMany({where:{userId:user.id}});
   await tx.verification.deleteMany({where:{value:user.id}});
   await tx.auditEvent.create({data:{actorId:user.id,objectId:user.id,action:"EMAIL_CHANGED",detail:JSON.stringify({oldEmail:change.oldEmail,newEmail:change.newEmail})}});
  }
  await tx.emailChange.update({where:{id:change.id},data:{oldConfirmed,newConfirmed,completedAt:oldConfirmed&&newConfirmed?now:null}});
  return {complete:oldConfirmed&&newConfirmed};
 });
}
