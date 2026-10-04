import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {saveLegal,decideLegal,assignLegal} from "@/lib/legal";
import {WorkflowError} from "@/lib/workflow";
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){try{checkOrigin(request);const actor=await sessionActor();const text=await request.text();if(text.length>250000)throw new WorkflowError("Formulaire trop volumineux.",413);const input=JSON.parse(text),{action}=await params;if(action==="save")return Response.json(await saveLegal(actor.id,input));if(action==="decide")return Response.json(await decideLegal(actor.id,input));if(action==="assign")return Response.json(await assignLegal(actor.id,input));throw new WorkflowError("Action inconnue.",404);}catch(e){return errorResponse(e);}}
