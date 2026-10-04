import { sessionActor } from "@/lib/session";
import { checkOrigin,errorResponse } from "@/lib/http";
import { WorkflowError } from "@/lib/workflow";
import { MAX_FILE_SIZE } from "@/lib/documents";
import { uploadPublicationAttachment } from "@/lib/publication-attachments";
export const runtime="nodejs";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();const size=Number(request.headers.get("content-length"));if(!size||size>MAX_FILE_SIZE+65536)throw new WorkflowError("Dépôt limité à 8 Mo.",413);const data=await request.formData(),file=data.get("file");if(!(file instanceof File)||file.size>MAX_FILE_SIZE)throw new WorkflowError("Choisissez un fichier de 8 Mo maximum.");return Response.json(await uploadPublicationAttachment(actor.id,{publicationId:data.get("publicationId"),version:Number(data.get("version")),caption:data.get("caption"),takenOn:data.get("takenOn")},file.name,Buffer.from(await file.arrayBuffer())));}catch(e){return errorResponse(e);}}
