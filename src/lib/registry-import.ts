import {randomUUID} from "node:crypto";
import {z} from "zod";
import {Prisma} from "@/generated/prisma/client";
import {db} from "./db";
import {WorkflowError} from "./workflow";
import {parseRegistryCsv,type ImportKind,type ImportRow} from "./registry-import-model";
const key=(s:string)=>s.trim().normalize("NFKC").toLocaleUpperCase("fr-FR");
const person=(s:string)=>key(s).normalize("NFKD").replace(/\p{M}/gu,"").replace(/\s+/g," ");
async function staff(tx:Prisma.TransactionClient,userId:string){const actor=await tx.user.findUnique({where:{id:userId}});if(!actor?.active||actor.role!=="ACQUIRER_AGENT")throw new WorkflowError("Import réservé à l’équipe acquéreurs.",403);}
async function analyze(tx:Prisma.TransactionClient,kind:ImportKind,records:string[][]):Promise<ImportRow[]>{
 const acquirers=kind==="ACQUIRERS"?await tx.acquirer.findMany({select:{id:true,reference:true,registeredName:true,email:true}}):[];
 const accounts=kind==="ACQUIRERS"?await tx.user.findMany({select:{email:true}}):[];
 const parcels=kind==="PARCELS"?await tx.parcel.findMany({select:{id:true,reference:true,cadastralReference:true,area:true}}):[];
 const refs=new Map<string,number>(),secondary=new Map<string,number>(),names=new Map<string,number>();
 for(const row of records){if(row[0])refs.set(key(row[0]),(refs.get(key(row[0]))??0)+1);const k=row[2]?key(row[2]):"";if(k)secondary.set(k,(secondary.get(k)??0)+1);if(kind==="ACQUIRERS"&&row[1])names.set(person(row[1]),(names.get(person(row[1]))??0)+1);}
 return records.map((raw,index)=>{
  const values=raw.map(s=>s.trim());if(values[0])values[0]=key(values[0]);if(kind==="ACQUIRERS"&&values[2])values[2]=values[2].toLowerCase();if(kind==="PARCELS"&&values[2])values[2]=key(values[2]);
  const row:ImportRow={line:index+2,values,state:"CREATE",message:"Nouvelle fiche",warnings:[]};
  const fail=(message:string):ImportRow=>({...row,state:"ERROR",message});
  if(values.length!==3)return fail("Trois colonnes sont attendues.");
  const [reference,second,third]=values;
  if(reference.length<2||reference.length>60)return fail("Référence requise : 2 à 60 caractères.");
  if((refs.get(key(reference))??0)>1)return fail("Référence répétée dans ce fichier.");
  if(third&&(secondary.get(key(third))??0)>1)return fail(kind==="ACQUIRERS"?"E-mail répété dans ce fichier.":"Référence cadastrale répétée dans ce fichier.");
  if(kind==="ACQUIRERS"){
   if(second.length<2||second.length>120)return fail("Nom requis : 2 à 120 caractères.");
   if(third.length>254||!z.email().safeParse(third).success)return fail("Adresse e-mail invalide ou manquante.");
   const matches=acquirers.filter(a=>key(a.reference)===key(reference)||key(a.email)===key(third));
   if(matches.length){const a=matches[0];if(matches.length===1&&key(a.reference)===key(reference)&&key(a.email)===key(third)&&a.registeredName===second)return {...row,state:"EXISTS",message:"Fiche identique, conservée sans modification",existingId:a.id};return fail("Référence ou e-mail déjà utilisé avec des informations différentes.");}
   if(accounts.some(u=>key(u.email)===key(third)))return fail("Cette adresse appartient déjà à un compte.");
   if(acquirers.some(a=>person(a.registeredName)===person(second))||(names.get(person(second))??0)>1)row.warnings.push("Nom similaire à une autre fiche : vérifiez qu’il s’agit d’une personne distincte.");
  }else{
   if(!/^\d+$/.test(second)||Number(second)<1||Number(second)>100000000)return fail("Superficie entière requise, de 1 à 100 000 000 m².");
   if(third.length<2||third.length>120)return fail("Référence cadastrale requise : 2 à 120 caractères.");
   const matches=parcels.filter(p=>key(p.reference)===key(reference)||key(p.cadastralReference)===key(third));
   if(matches.length){const p=matches[0];if(matches.length===1&&key(p.reference)===key(reference)&&key(p.cadastralReference)===key(third)&&p.area===Number(second))return {...row,state:"EXISTS",message:"Parcelle identique, conservée sans modification",existingId:p.id};return fail("Référence interne ou cadastrale déjà utilisée avec des informations différentes.");}
  }
  return row;
 });
}
export async function previewRegistryImport(userId:string,input:unknown){
 const v=z.object({kind:z.enum(["ACQUIRERS","PARCELS"]),filename:z.string().trim().min(1).max(160),csv:z.string().max(262144)}).strict().parse(input);
 if(Buffer.byteLength(v.csv,"utf8")>262144)throw new WorkflowError("Fichier limité à 256 Ko.");
 let records:string[][];try{records=parseRegistryCsv(v.csv,v.kind);}catch(e){throw new WorkflowError(e instanceof Error?e.message:"CSV illisible.");}
 return db.$transaction(async tx=>{await staff(tx,userId);const rows=await analyze(tx,v.kind,records);const batch=await tx.registryImport.create({data:{actorId:userId,kind:v.kind,filename:v.filename,source:records,report:rows,expiresAt:new Date(Date.now()+3600000)}});await tx.auditEvent.create({data:{actorId:userId,objectId:batch.id,action:"REGISTRY_IMPORT_PREVIEW",detail:JSON.stringify({kind:v.kind,filename:v.filename,count:rows.length})}});return {id:batch.id};});
}
export async function confirmRegistryImport(userId:string,input:unknown){
 const v=z.object({id:z.string().min(1),confirmed:z.literal(true),warningsAccepted:z.boolean()}).strict().parse(input);
 try{return await db.$transaction(async tx=>{
  await staff(tx,userId);const batch=await tx.registryImport.findFirst({where:{id:v.id,actorId:userId}});if(!batch)throw new WorkflowError("Import inaccessible.",404);
  if(batch.status==="COMPLETED")return {success:true};
  if(batch.expiresAt<=new Date())throw new WorkflowError("L’aperçu a expiré. Analysez de nouveau le fichier.",409);
  const rows=await analyze(tx,batch.kind as ImportKind,batch.source as string[][]);
  if(JSON.stringify(rows)!==JSON.stringify(batch.report))throw new WorkflowError("Le registre a changé depuis l’aperçu. Analysez de nouveau le fichier.",409);
  if(rows.some(r=>r.state==="ERROR"))throw new WorkflowError("Corrigez les lignes signalées puis analysez de nouveau le fichier.",409);
  if(rows.some(r=>r.warnings.length)&&!v.warningsAccepted)throw new WorkflowError("Vérifiez les noms similaires avant de confirmer.");
  const changed=await tx.registryImport.updateMany({where:{id:batch.id,status:"PREVIEW",actorId:userId},data:{status:"COMPLETED",committedAt:new Date()}});if(changed.count!==1)throw new WorkflowError("Cet import a déjà été traité.",409);
  const created:{id:string;reference:string}[]=[];
  for(const row of rows.filter(r=>r.state==="CREATE")){
   const [reference,second,third]=row.values;
   const item=batch.kind==="ACQUIRERS"?await tx.acquirer.create({data:{reference,registeredName:second,email:third,personId:randomUUID()}}):await tx.parcel.create({data:{reference,area:Number(second),cadastralReference:third}});
   created.push({id:item.id,reference});
   await tx.auditEvent.create({data:{actorId:userId,objectId:item.id,action:batch.kind==="ACQUIRERS"?"ACQUIRER_REGISTERED":"PARCEL_REGISTERED",detail:JSON.stringify({importId:batch.id,line:row.line})}});
  }
  await tx.registryImport.update({where:{id:batch.id},data:{result:{created,unchanged:rows.filter(r=>r.state==="EXISTS").length}}});
  await tx.auditEvent.create({data:{actorId:userId,objectId:batch.id,action:"REGISTRY_IMPORT_CONFIRMED",detail:JSON.stringify({created:created.length,unchanged:rows.length-created.length})}});
  return {success:true};
 });}catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002")throw new WorkflowError("Une référence vient d’être utilisée. Aucun ajout effectué ; analysez à nouveau le fichier.",409);throw e;}
}
