import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import {db} from "./db";
import type {Prisma} from "@/generated/prisma/client";
function key(){const secret=process.env.BETTER_AUTH_SECRET;if(!secret||secret.length<32)throw new Error("Configurer la clé de protection des courriels.");return createHash("sha256").update(`mail:v1:${secret}`).digest();}
function seal(text:string){const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);return Buffer.concat([iv,cipher.update(text,"utf8"),cipher.final(),cipher.getAuthTag()]).toString("base64");}
function open(value:string){const b=Buffer.from(value,"base64"),d=createDecipheriv("aes-256-gcm",key(),b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString("utf8");}
export async function queueMail(input:{key:string;recipient:string;userId?:string;kind:string;subject:string;text:string;expiresAt:Date},tx:Prisma.TransactionClient=db){
 const payload=seal(JSON.stringify({from:process.env.MAIL_FROM??"",subject:input.subject,text:input.text}));
 return tx.emailDelivery.upsert({where:{key:input.key},update:{},create:{key:input.key,recipient:input.recipient,userId:input.userId,kind:input.kind,payload,expiresAt:input.expiresAt}});
}
export async function accountMail(user:{id:string;email:string},url:string,kind:"RESET"|"VERIFY"){
 const actor=await db.user.findUnique({where:{id:user.id}});if(!actor?.active)return;
 const base=new URL(process.env.BETTER_AUTH_URL!);if(new URL(url).origin!==base.origin)throw new Error("Lien de compte invalide.");
 await queueMail({key:`${kind}:${createHash("sha256").update(url).digest("hex")}`,recipient:user.email,userId:user.id,kind,subject:kind==="RESET"?"Réinitialiser votre mot de passe Kip-City":"Vérifier votre adresse Kip-City",text:`${kind==="RESET"?"Pour choisir un nouveau mot de passe":"Pour vérifier votre adresse"}, ouvrez ce lien :\n${url}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.`,expiresAt:new Date(Date.now()+(kind==="RESET"?15:60)*60000)});
}
export function mailReadiness(){
 const enabled=process.env.MAIL_ENABLED==="true",keyConfigured=!!process.env.RESEND_API_KEY?.trim();
 const from=process.env.MAIL_FROM?.trim()??"";
 const senderConfigured=/^(?:[^<>\r\n]+ <)?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/.test(from)&&!/[\r\n]/.test(from);
 return {enabled,keyConfigured,senderConfigured,autorun:process.env.MAIL_AUTORUN==="true",ready:enabled&&keyConfigured&&senderConfigured};
}
type Transport=(input:{from:string;to:string[];subject:string;text:string},id:string)=>Promise<string>;
export const resendTransport:Transport=async(input,id)=>{
 if(process.env.MAIL_ENABLED!=="true"||!process.env.RESEND_API_KEY||!input.from)throw new Error("MAIL_NOT_CONFIGURED");
 const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`kipcity/${id}`},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`MAIL_HTTP_${response.status}`);const body=await response.json();if(typeof body.id!=="string")throw new Error("MAIL_RESPONSE_INVALID");return body.id;
};
export async function deliverMail(transport:Transport=resendTransport,now=new Date()){
 if(transport===resendTransport&&!mailReadiness().ready)return {enabled:mailReadiness().enabled,configured:false,processed:0};
 const candidates=await db.emailDelivery.findMany({where:{OR:[{status:"PENDING",availableAt:{lte:now}},{status:"SENDING",leaseUntil:{lt:now}}]},orderBy:{createdAt:"asc"},take:20});let processed=0;
 for(const item of candidates){
  if(transport===resendTransport&&/@(?:[^@]+\.)?(?:test|invalid|example|localhost)$/i.test(item.recipient)){
   await db.emailDelivery.updateMany({where:{id:item.id,status:item.status,attempts:item.attempts},data:{status:"CANCELLED",payload:"",leaseUntil:null,lastError:"Adresse fictive : aucun envoi réel."}});
   continue;
  }
  const changed=await db.emailDelivery.updateMany({where:{id:item.id,status:item.status,attempts:item.attempts,...(item.status==="SENDING"?{leaseUntil:{lt:now}}:{})},data:{status:"SENDING",attempts:{increment:1},firstAttemptAt:item.firstAttemptAt??now,leaseUntil:new Date(now.getTime()+60000)}});if(!changed.count)continue;
  const actor=item.userId?await db.user.findUnique({where:{id:item.userId}}):null;
  if(item.expiresAt<=now||(item.userId&&(!actor?.active||(item.kind!=="EMAIL_CHANGE"&&actor.email!==item.recipient)))){await db.emailDelivery.update({where:{id:item.id},data:{status:"CANCELLED",payload:"",leaseUntil:null}});continue;}
  // Provider deduplication lasts 24 hours: an uncertain old send needs human reconciliation.
  if(item.firstAttemptAt&&now.getTime()-item.firstAttemptAt.getTime()>23*3600000){await db.emailDelivery.update({where:{id:item.id},data:{status:"REVIEW",lastError:"Vérifier le résultat chez le fournisseur avant toute reprise.",leaseUntil:null}});continue;}
  try{const body=JSON.parse(open(item.payload));if(!body.from&&!item.firstAttemptAt){body.from=process.env.MAIL_FROM??"";await db.emailDelivery.update({where:{id:item.id},data:{payload:seal(JSON.stringify(body))}});}const id=await transport({...body,to:[item.recipient]},item.id);await db.emailDelivery.update({where:{id:item.id},data:{status:"SENT",providerId:id,sentAt:now,lastError:null,leaseUntil:null,payload:""}});processed++;}
  catch(error){const code=error instanceof Error&&/^MAIL_[A-Z_0-9]+$/.test(error.message)?error.message:"MAIL_RETRY";const permanent=/HTTP_(400|401|403|409|422)$/.test(code)||code==="MAIL_NOT_CONFIGURED";await db.emailDelivery.update({where:{id:item.id},data:{status:permanent||item.attempts>=4?"REVIEW":"PENDING",lastError:code,availableAt:new Date(now.getTime()+Math.min(3600000,60000*2**item.attempts)),leaseUntil:null}});}
 }
 return {enabled:true,processed};
}
