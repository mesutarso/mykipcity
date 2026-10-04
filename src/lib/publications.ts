import {activeParcelWhere} from "./parcel-access-model";
import { z } from "zod";
import { db } from "./db";
import { WorkflowError,getActor,requireStaff } from "./workflow";
import { publicationContent } from "./publication-model";
const cover={where:{removedAt:null,mimeType:{in:["image/png","image/jpeg"]}},select:{id:true,caption:true},orderBy:{createdAt:"asc" as const},take:1};
const inputSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("publish"),id:z.string().min(1),version:z.number().int().positive(),reason:z.string().trim().min(3).max(1000),publishAt:z.string().datetime({offset:true}).optional()}).strict(),
 z.object({action:z.literal("save"),id:z.string().optional(),version:z.number().int().nonnegative(),content:publicationContent}).strict(),
 z.object({action:z.enum(["submit","return","withdraw","reopen","archive","restore"]),id:z.string().min(1),version:z.number().int().positive(),reason:z.string().trim().min(3,"Indiquez un motif.").max(1000)}).strict(),
]);
export async function changePublication(userId:string,input:unknown){
 const v=inputSchema.parse(input);
 return db.$transaction(async tx=>{
  const actor=await tx.user.findUnique({where:{id:userId}});
  if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Accès réservé à l’équipe acquéreurs.",403);
  const current=v.id?await tx.memberPublication.findUnique({where:{id:v.id}}):null;
  if(v.id&&!current)throw new WorkflowError("Publication introuvable.",404);
  if((current?.version??0)!==v.version)throw new WorkflowError("Cette publication a changé. Rechargez la page.",409);
  let result;
  if(v.action==="save"){
   if(current&&(current.authorId!==userId||current.status!=="DRAFT"))throw new WorkflowError("Seul l’auteur peut modifier son brouillon.",403);
   let targetId:string|null=null;
   const content={...v.content,targetReference:v.content.targetReference.toUpperCase()};
   if(content.audience==="ACQUIRER"){
    const target=await tx.acquirer.findUnique({where:{reference:content.targetReference},select:{id:true}});
    if(!target)throw new WorkflowError("Référence acquéreur inconnue.");targetId=target.id;
   }
   if(content.audience==="PARCEL"){
    const target=await tx.parcel.findUnique({where:{reference:content.targetReference},select:{id:true}});
    if(!target)throw new WorkflowError("Référence parcelle inconnue.");targetId=target.id;
   }
   result=current?await tx.memberPublication.update({where:{id:current.id,version:v.version},data:{...content,targetId,version:{increment:1}}}):await tx.memberPublication.create({data:{...content,targetId,authorId:userId,authorPersonId:actor.personId}});
  }else{
   if(!current)throw new WorkflowError("Publication introuvable.",404);
   const author=current.authorId===userId;
   let status:string;
   const publishAt=v.action==="publish"&&v.publishAt?new Date(v.publishAt):new Date();
   if(v.action==="publish"&&v.publishAt&&publishAt.getTime()<Date.now())throw new WorkflowError("Choisissez une date de publication future.");
   if(v.action==="submit"&&author&&current.status==="DRAFT")status="IN_REVIEW";
   else if((v.action==="publish"||v.action==="return")&&current.status==="IN_REVIEW"){
    const currentAuthor=await tx.user.findUnique({where:{id:current.authorId},select:{personId:true}});
    if(author||actor.personId===current.authorPersonId||actor.personId===currentAuthor?.personId)throw new WorkflowError("La relecture doit être effectuée par une autre personne.",403);
    status=v.action==="publish"?"PUBLISHED":"DRAFT";
   }else if(v.action==="withdraw"&&current.status==="PUBLISHED")status="WITHDRAWN";
   else if(v.action==="reopen"&&author&&current.status==="WITHDRAWN")status="DRAFT";
   else if(v.action==="archive"&&author&&["DRAFT","WITHDRAWN"].includes(current.status))status="ARCHIVED";
   else if(v.action==="restore"&&author&&current.status==="ARCHIVED")status="DRAFT";
   else throw new WorkflowError("Cette action n’est pas disponible pour cette publication.",409);
   result=await tx.memberPublication.update({where:{id:current.id,version:v.version},data:{status,version:{increment:1},...(v.action==="publish"?{reviewerId:userId,publishedAt:publishAt}:status==="DRAFT"?{reviewerId:null}:{})}});
  }
  const attachments=v.action==="publish"?await tx.publicationAttachment.findMany({where:{publicationId:result.id,removedAt:null},select:{id:true,caption:true,takenOn:true,sha256:true,mimeType:true}}):undefined;
  await tx.auditEvent.create({data:{actorId:userId,objectId:result.id,action:`PUBLICATION_${v.action.toUpperCase()}`,detail:JSON.stringify({actorName:actor.name,version:result.version,status:result.status,publishedAt:result.publishedAt,attachments,...(v.action==="save"?{content:v.content,targetId:result.targetId}:{reason:v.reason})})}});
  return {id:result.id};
 });
}
export async function staffPublication(userId:string,id:string){
 await requireStaff(userId);
 const row=await db.memberPublication.findUnique({where:{id}});
 if(!row)throw new WorkflowError("Publication introuvable.",404);
 return row;
}
// Re-evaluate parcel permissions at every read, including direct article URLs.
async function memberScope(userId:string,parcelId?:string){
 const actor=await getActor(userId);if(actor.role!=="ACQUIRER")throw new WorkflowError("Accès réservé aux acquéreurs.",403);
 const files=await db.acquirerFile.findMany({where:{acquirer:{userId},declarations:{some:activeParcelWhere()}},select:{acquirerId:true,declarations:{where:activeParcelWhere(),select:{parcelId:true,reference:true}}}});
 const parcels=[...new Map(files.flatMap(f=>f.declarations.filter(d=>d.parcelId).map(d=>({id:d.parcelId!,reference:d.reference}))).map(p=>[p.id,p])).values()];
 if(parcelId&&!parcels.some(p=>p.id===parcelId))throw new WorkflowError("Parcelle inaccessible.",404);
 const eligible=files.length>0;
 const where={status:"PUBLISHED",publishedAt:{lte:new Date()},id:eligible?undefined:{in:[] as string[]},OR:[
  {audience:"MEMBERS"},
  {audience:"ACQUIRER",targetId:{in:files.map(f=>f.acquirerId)}},
  {audience:"PARCEL",targetId:{in:parcelId?[parcelId]:parcels.map(p=>p.id)}},
 ]};
 return {where,parcels,eligible};
}
export async function memberPublications(userId:string,parcelId?:string,page=1){
 const scope=await memberScope(userId,parcelId);
 const skip=(Math.max(1,Math.min(100000,Math.floor(page)||1))-1)*12;
 const [items,count]=await Promise.all([
  db.memberPublication.findMany({where:scope.where,select:{id:true,title:true,body:true,audience:true,targetReference:true,publishedAt:true,attachments:cover},orderBy:[{publishedAt:"desc"},{id:"desc"}],take:12,skip}),
  db.memberPublication.count({where:scope.where}),
 ]);
 return {...scope,where:undefined,items,count};
}
export async function memberPublication(userId:string,id:string){
 const {where}=await memberScope(userId);
 const item=await db.memberPublication.findFirst({where:{AND:[where,{id}]},select:{id:true,title:true,body:true,audience:true,targetReference:true,publishedAt:true,attachments:cover}});
 if(!item)throw new WorkflowError("Information inaccessible.",404);
 return item;
}
export async function memberDashboardPublications(userId:string,parcelId?:string){
 const {where,parcels}=await memberScope(userId,parcelId);
 const select={id:true,title:true,body:true,audience:true,targetReference:true,publishedAt:true,attachments:cover} as const;
 const orderBy=[{publishedAt:"desc"},{id:"desc"}] as const;
 const [personal,general]=await Promise.all([
  db.memberPublication.findMany({where:{AND:[where,{audience:{in:["ACQUIRER","PARCEL"]}}]},select,orderBy:[...orderBy],take:3}),
  db.memberPublication.findMany({where:{AND:[where,{audience:"MEMBERS"}]},select,orderBy:[...orderBy],take:3}),
 ]);
 return {personal,general,parcels};
}
