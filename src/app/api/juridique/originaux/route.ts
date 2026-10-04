import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {recordOriginal} from "@/lib/originals";
import {MAX_FILE_SIZE} from "@/lib/documents";
import {WorkflowError} from "@/lib/workflow";
export const runtime="nodejs";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor(),size=Number(request.headers.get("content-length"));if(!size||size>MAX_FILE_SIZE+100000)throw new WorkflowError("Dépôt limité à 8 Mo.",413);const form=await request.formData(),file=form.get("file"),input=form.get("input");if(!(file instanceof File)||file.size>MAX_FILE_SIZE||typeof input!=="string"||input.length>60000)throw new WorkflowError("Vérifiez le formulaire et choisissez un fichier de 8 Mo maximum.");let data;try{data=JSON.parse(input);}catch{throw new WorkflowError("Saisie invalide.");}return Response.json(await recordOriginal(actor.id,data,file.name,Buffer.from(await file.arrayBuffer())));}catch(e){return errorResponse(e);}}
