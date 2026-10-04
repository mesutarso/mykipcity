import {db} from "./db";
import {notifications} from "./notifications";
import {queueMail} from "./mail";
import {memberFinance} from "./member-finance";
export async function prepareReminders(now=new Date()){
 const day=now.toLocaleDateString("en-CA",{timeZone:"Africa/Kinshasa"}),tomorrow=new Date(now.getTime()+86400000).toLocaleDateString("en-CA",{timeZone:"Africa/Kinshasa"});let prepared=0;
 const users=await db.user.findMany({where:{active:true,emailVerified:true},select:{id:true,email:true,role:true}});
 for(const user of users){
  const unread=(await notifications(user.id)).filter(n=>!n.read);
  const reasons:string[]=[];if(unread.length)reasons.push("Des informations non lues vous attendent dans votre espace.");
  if(user.role==="ACQUIRER"){
   const files=await db.acquirerFile.findMany({where:{acquirer:{userId:user.id}},include:{declarations:true}});
   if(files.some(file=>["DRAFT","NEEDS_INFO"].includes(file.status)&&now.getTime()-file.updatedAt.getTime()>=7*86400000))reasons.push("Votre dossier reste à compléter.");
   if(files.some(file=>file.declarations.some(d=>d.status==="APPROVED"&&!d.accessRevokedAt&&d.accessExpiresAt&&d.accessExpiresAt>now&&d.accessExpiresAt.getTime()-now.getTime()<=7*86400000)))reasons.push("Des droits d’accès arrivent à échéance. Consultez votre dossier.");
   const finance=await memberFinance(user.id);if(finance.some(f=>[day,tomorrow].includes(f.content.appointmentDate)))reasons.push("Un rendez-vous est prévu prochainement. Consultez ses détails dans votre espace.");
  }
  if(!reasons.length)continue;
  await queueMail({key:`reminder:${user.id}:${day}`,recipient:user.email,userId:user.id,kind:"REMINDER",subject:"Kip-City — votre suivi",text:`${reasons.join("\n")}\n\nConnectez-vous : ${process.env.BETTER_AUTH_URL}/notifications`,expiresAt:new Date(now.getTime()+86400000)});prepared++;
 }
 return {prepared};
}
