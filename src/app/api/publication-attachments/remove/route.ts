import { sessionActor } from "@/lib/session";
import { checkOrigin,errorResponse } from "@/lib/http";
import { WorkflowError } from "@/lib/workflow";
import { removePublicationAttachment } from "@/lib/publication-attachments";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();const text=await request.text();if(text.length>5000)throw new WorkflowError("Formulaire trop volumineux.",413);return Response.json(await removePublicationAttachment(actor.id,JSON.parse(text)));}catch(e){return errorResponse(e);}}
