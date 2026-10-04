import {storeMessageFile,deletePreparedMessageFile,messageFileBytes} from "./message-file-storage";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { db } from "./db";
import { getActor, requireStaff, WorkflowError } from "./workflow";

function duplicate(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new WorkflowError(message, 409);
  throw error;
}
export async function registerAcquirer(actorId: string, input: unknown) {
  await requireStaff(actorId);
  const value = z.object({
    reference: z.string().trim().min(2).max(60).transform(v => v.toUpperCase()),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254).transform(v => v.toLowerCase()),
  }).strict().parse(input);
  try {
    return await db.$transaction(async tx => {
      if (await tx.user.findUnique({ where: { email: value.email } })) throw new WorkflowError("Cette adresse est déjà associée à un compte.", 409);
      const acquirer = await tx.acquirer.create({ data: { reference: value.reference, registeredName: value.name, email: value.email, personId: randomUUID() } });
      await tx.auditEvent.create({ data: { actorId, action: "ACQUIRER_REGISTERED", objectId: acquirer.id } });
      return { id: acquirer.id };
    });
  } catch (error) { duplicate(error, "Cette référence ou cette adresse e-mail existe déjà."); }
}
export async function registerParcel(actorId: string, input: unknown) {
  await requireStaff(actorId);
  const value = z.object({
    reference: z.string().trim().min(2).max(60).transform(v => v.toUpperCase()),
    area: z.number().int().positive().max(100000000),
    cadastralReference: z.string().trim().min(2).max(120),
  }).strict().parse(input);
  try {
    return await db.$transaction(async tx => {
      const parcel = await tx.parcel.create({ data: value });
      await tx.auditEvent.create({ data: { actorId, action: "PARCEL_REGISTERED", objectId: parcel.id } });
      return { id: parcel.id };
    });
  } catch (error) { duplicate(error, "Une parcelle porte déjà cette référence."); }
}
export async function conversation(userId: string, fileId: string) {
  const actor = await getActor(userId);
  const file = await db.acquirerFile.findUnique({ where: { id: fileId }, include: { acquirer: true } });
  if (!file || (actor.role !== "ACQUIRER_AGENT" && !(actor.role === "ACQUIRER" && file.acquirer.userId === actor.id))) throw new WorkflowError("Conversation inaccessible.", 404);
  return file;
}
export async function sendMessage(userId: string, input: unknown, upload?:{name:string;bytes:Buffer}) {
  const value = z.object({
    fileId:z.string().min(1),body:z.string().trim().min(1,"Écrivez votre message.").max(4000),
    subject:z.string().trim().max(160).default(""),parcelReference:z.string().trim().max(120).default(""),
    attachmentId:z.string().max(100).nullable().optional(),clientToken:z.string().uuid().optional(),
  }).strict().parse(input);
  if(upload&&(!value.clientToken||value.attachmentId))throw new WorkflowError("Choisissez un fichier ou un document du dossier, et recommencez l’envoi.");
  await conversation(userId,value.fileId);
  const stored=upload?await storeMessageFile(upload.name,upload.bytes):null;
  let saved=false;
  try{const result=await db.$transaction(async tx=>{
    const actor=await tx.user.findUnique({where:{id:userId}});
    const file=await tx.acquirerFile.findUnique({where:{id:value.fileId},include:{acquirer:true,declarations:true}});
    if(!actor?.active||!file||(actor.role!=="ACQUIRER_AGENT"&&!(actor.role==="ACQUIRER"&&file.acquirer.userId===userId)))throw new WorkflowError("Conversation inaccessible.",404);
    if(value.clientToken){const prior=await tx.message.findUnique({where:{authorId_clientToken:{authorId:userId,clientToken:value.clientToken}}});if(prior){if(prior.fileId!==file.id||prior.body!==value.body||prior.subject!==value.subject||prior.parcelReference!==value.parcelReference||(prior.attachmentId??null)!==(value.attachmentId||null)||(prior.uploadSha256??null)!==(stored?.uploadSha256??null)||(prior.uploadName??null)!==(stored?.uploadName??null))throw new WorkflowError("Cet envoi a déjà été utilisé pour un autre message.",409);return {id:prior.id,created:false};}}
    if(value.parcelReference&&!file.declarations.some(d=>d.reference===value.parcelReference))throw new WorkflowError("Choisissez une parcelle de ce dossier.");
    if(value.attachmentId){
      const attachment=await tx.memberDocumentVersion.findFirst({where:{id:value.attachmentId,document:{fileId:file.id,...(actor.role==="ACQUIRER"?{OR:[{direction:"REQUESTED"},{closedAt:null}]}:{})}}});
      if(!attachment)throw new WorkflowError("Document inaccessible.",404);
    }
    const message=await tx.message.create({data:{...value,...(stored??{}),attachmentId:value.attachmentId||null,authorId:userId}});
    await tx.auditEvent.create({data:{actorId:userId,action:"MESSAGE_SENT",objectId:file.id,detail:message.id}});
    return {id:message.id,created:true};
  });saved=result.created;return {id:result.id};
  }finally{if(stored&&!saved)await deletePreparedMessageFile(stored.uploadStorageKey);}
}
export async function conversationPage(userId:string,fileId:string,page=1){
  await conversation(userId,fileId);
  const number=Math.max(1,Math.min(100000,Math.floor(page)||1));
  const [messages,count]=await Promise.all([
    db.message.findMany({where:{fileId},include:{author:{select:{name:true,role:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:25,skip:(number-1)*25}),
    db.message.count({where:{fileId}}),
  ]);
  // Reads are personal; one agent reading a message does not mark it read for colleagues.
  const receipts=await db.notificationReceipt.findMany({where:{notificationId:{in:messages.filter(m=>m.authorId===userId).map(m=>`message:${m.id}`)},NOT:{userId}},select:{notificationId:true,userId:true,readAt:true}});
  const readers=await db.user.findMany({where:{id:{in:receipts.map(r=>r.userId)},active:true},select:{id:true,role:true}});
  return {messages:messages.reverse().map(m=>({...m,readByRecipient:receipts.some(r=>r.notificationId===`message:${m.id}`&&readers.some(a=>a.id===r.userId&&(m.author.role==="ACQUIRER"?a.role==="ACQUIRER_AGENT":a.role==="ACQUIRER")))})),count,page:number};
}

export async function readMessageFile(userId:string,id:string){
 const message=await db.message.findUnique({where:{id}});if(!message?.uploadStorageKey||!message.uploadSha256||!message.uploadName||message.uploadSize===null)throw new WorkflowError("Pièce jointe inaccessible.",404);
 await conversation(userId,message.fileId);
 const bytes=await messageFileBytes(message.uploadStorageKey,message.uploadSha256,message.uploadSize);
 await db.auditEvent.create({data:{actorId:userId,objectId:message.fileId,action:"MESSAGE_FILE_DOWNLOADED",detail:message.id}});
 return {name:message.uploadName,bytes};
}

export async function assignConversation(userId:string,input:unknown){
 const v=z.object({fileId:z.string().min(1),version:z.number().int().nonnegative(),targetId:z.string().min(1).nullable(),reason:z.string().trim().min(10).max(1000)}).strict().parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Accès réservé à l’équipe acquéreurs.",403);
  const file=await tx.acquirerFile.findUnique({where:{id:v.fileId}});if(!file)throw new WorkflowError("Dossier introuvable.",404);
  if(file.contactOwnerId===v.targetId)throw new WorkflowError("Choisissez un autre interlocuteur.");
  const target=v.targetId?await tx.user.findUnique({where:{id:v.targetId}}):null;
  if(v.targetId&&(!target?.active||target.role!=="ACQUIRER_AGENT"))throw new WorkflowError("Choisissez un gestionnaire acquéreurs actif.",409);
  const previous=file.contactOwnerId?await tx.user.findUnique({where:{id:file.contactOwnerId}}):null;
  const changed=await tx.acquirerFile.updateMany({where:{id:file.id,contactVersion:v.version},data:{contactOwnerId:v.targetId,contactVersion:{increment:1}}});
  if(changed.count!==1)throw new WorkflowError("L’affectation a changé. Rechargez la page.",409);
  await tx.auditEvent.create({data:{actorId:userId,objectId:file.id,action:"CONTACT_ASSIGNED",detail:JSON.stringify({actorName:actor.name,previousId:previous?.id??null,previousName:previous?.name??"Équipe",targetId:target?.id??null,targetName:target?.name??"Équipe",reason:v.reason,version:v.version+1})}});
  return {success:true};
 });
}
// The shared queue remains available for continuity when a colleague is absent.
export async function contactQueue(userId:string,scope:string="mine"){
 await requireStaff(userId);
 const active=await db.user.findMany({where:{role:"ACQUIRER_AGENT",active:true},select:{id:true}});
 return scope==="all"?{}:scope==="unassigned"?{OR:[{contactOwnerId:null},{contactOwnerId:{notIn:active.map(u=>u.id)}}]}:{contactOwnerId:userId};
}
