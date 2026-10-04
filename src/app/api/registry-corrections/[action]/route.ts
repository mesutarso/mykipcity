import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {correctRegistry,mergeRegistry,correctIdentity} from "@/lib/registry-corrections";
import {WorkflowError} from "@/lib/workflow";
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){try{checkOrigin(request);const actor=await sessionActor(),{action}=await params;const body=await request.text();if(body.length>5000)throw new WorkflowError("Formulaire trop volumineux.",413);const input=JSON.parse(body);if(action==="correct")return Response.json(await correctRegistry(actor.id,input));if(action==="merge")return Response.json(await mergeRegistry(actor.id,input));if(action==="identity")return Response.json(await correctIdentity(actor.id,input));throw new WorkflowError("Action inconnue.",404);}catch(e){return errorResponse(e);}}
