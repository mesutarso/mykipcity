import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {classifyDocument} from "@/lib/documents";
import {WorkflowError} from "@/lib/workflow";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();const text=await request.text();if(text.length>10000)throw new WorkflowError("Formulaire trop volumineux.",413);let body:unknown;try{body=JSON.parse(text);}catch{throw new WorkflowError("Formulaire illisible.");}return Response.json(await classifyDocument(actor.id,body));}catch(e){return errorResponse(e);}}
