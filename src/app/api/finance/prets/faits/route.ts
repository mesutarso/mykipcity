import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {depositLoanEvent} from "@/lib/loans";
import {MAX_FILE_SIZE} from "@/lib/documents";
import {WorkflowError} from "@/lib/workflow";
export const runtime="nodejs";
export async function POST(request:Request){try{
 checkOrigin(request);const actor=await sessionActor(),size=Number(request.headers.get("content-length"));
 if(!size||size>MAX_FILE_SIZE+1000000)throw new WorkflowError("Dépôt limité à 8 Mo.",413);
 const f=await request.formData(),file=f.get("file"),input=f.get("input");if(!(file instanceof File)||file.size>MAX_FILE_SIZE||typeof input!=="string"||input.length>500000)throw new WorkflowError("Choisissez un justificatif de 8 Mo maximum.");
 let data;try{data=JSON.parse(input);}catch{throw new WorkflowError("Saisie invalide.");}
 return Response.json(await depositLoanEvent(actor.id,data,file.name,Buffer.from(await file.arrayBuffer())));
 }catch(e){return errorResponse(e);}}
