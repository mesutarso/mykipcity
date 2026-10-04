import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {sendMessage} from "@/lib/management";
import {MAX_FILE_SIZE} from "@/lib/documents";
import {WorkflowError} from "@/lib/workflow";
export const runtime="nodejs";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();const size=Number(request.headers.get("content-length"));if(!size||size>MAX_FILE_SIZE+65536)throw new WorkflowError("Pièce jointe limitée à 8 Mo.",413);
 const form=await request.formData(),file=form.get("file");if(!(file instanceof File)||!file.size||file.size>MAX_FILE_SIZE)throw new WorkflowError("Choisissez un fichier de 8 Mo maximum.");
 const result=await sendMessage(actor.id,{fileId:form.get("fileId"),subject:form.get("subject"),body:form.get("body"),parcelReference:form.get("parcelReference"),clientToken:form.get("clientToken"),attachmentId:form.get("attachmentId")||null},{name:file.name,bytes:Buffer.from(await file.arrayBuffer())});return Response.json(result);
}catch(e){return errorResponse(e);}}
