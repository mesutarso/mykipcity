import {db} from "./db";
import {staffPublication} from "./publications";
import {publicationContent,type PublicationContent} from "./publication-model";
import {WorkflowError} from "./workflow";
export type PublicationVersion={version:number;action:string;status:string;actor:string;date:string;content:PublicationContent;attachments:{id:string;name:string;caption:string;takenOn:string;sha256:string}[]};
export async function publicationHistory(userId:string,id:string){
 const item=await staffPublication(userId,id);
 const [events,files]=await Promise.all([db.auditEvent.findMany({where:{objectId:id,action:{startsWith:"PUBLICATION_"}},select:{action:true,detail:true,createdAt:true},orderBy:[{createdAt:"asc"},{id:"asc"}]}),db.publicationAttachment.findMany({where:{publicationId:id},select:{id:true,originalName:true,caption:true,takenOn:true,sha256:true}})]);
 const parsed=events.flatMap(event=>{let detail:Record<string,unknown>;try{detail=JSON.parse(event.detail);}catch{return [];}return detail&&Number.isSafeInteger(detail.version)&&Number(detail.version)>0?[{...event,detail,version:Number(detail.version)}]:[];}).sort((a,b)=>a.version-b.version);
 const versions:PublicationVersion[]=[];let content:PublicationContent|null=null,status="DRAFT";const attachments=new Set<string>();
 for(const e of parsed){
  if(e.action==="PUBLICATION_SAVE"){
   const value=publicationContent.safeParse(e.detail.content);if(!value.success){content=null;continue;}content={...value.data,targetReference:value.data.targetReference.toUpperCase()};
  }
  if(typeof e.detail.status==="string")status=e.detail.status;
  if(e.action==="PUBLICATION_ATTACHMENT_ADDED"&&typeof e.detail.attachmentId==="string")attachments.add(e.detail.attachmentId);
  if(e.action==="PUBLICATION_ATTACHMENT_REMOVED"&&typeof e.detail.attachmentId==="string")attachments.delete(e.detail.attachmentId);
  if(!content)continue;
  versions.push({version:e.version,action:e.action,status,actor:typeof e.detail.actorName==="string"?e.detail.actorName:"Équipe acquéreurs",date:e.createdAt.toISOString(),content:{...content},attachments:files.filter(f=>attachments.has(f.id)).map(f=>({id:f.id,name:f.originalName,caption:f.caption,takenOn:f.takenOn,sha256:f.sha256})).sort((a,b)=>a.id.localeCompare(b.id))});
 }
 return {item,versions:versions.sort((a,b)=>b.version-a.version)};
}
export function comparePublicationVersions(versions:PublicationVersion[],before?:string,after?:string){
 const find=(requested:string|undefined,fallback:PublicationVersion|undefined)=>{if(requested===undefined)return fallback;if(!/^[1-9]\d*$/.test(requested))throw new WorkflowError("Version introuvable.",404);const result=versions.find(v=>v.version===Number(requested));if(!result)throw new WorkflowError("Version introuvable.",404);return result;};
 const left=find(before,versions[1]??versions[0]),right=find(after,versions[0]);
 if(!left||!right)return null;
 return {left,right,changes:{title:left.content.title!==right.content.title,body:left.content.body!==right.content.body,audience:left.content.audience!==right.content.audience||left.content.targetReference!==right.content.targetReference,status:left.status!==right.status,attachments:JSON.stringify(left.attachments)!==JSON.stringify(right.attachments)}};
}
