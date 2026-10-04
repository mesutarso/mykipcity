import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {assignConversation} from "@/lib/management";
import {WorkflowError} from "@/lib/workflow";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();const body=await request.text();if(body.length>5000)throw new WorkflowError("Formulaire trop volumineux.",413);return Response.json(await assignConversation(actor.id,JSON.parse(body)));}catch(e){return errorResponse(e);}}
