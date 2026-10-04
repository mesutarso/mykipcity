import { sessionActor } from "@/lib/session";
import { checkOrigin,errorResponse } from "@/lib/http";
import { createMemberDocument } from "@/lib/member-documents";
import { WorkflowError } from "@/lib/workflow";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();const text=await request.text();if(text.length>20000)throw new WorkflowError("Formulaire trop volumineux.",413);return Response.json(await createMemberDocument(actor.id,JSON.parse(text)));}catch(e){return errorResponse(e);}}
