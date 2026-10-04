import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {closeMemberDocument} from "@/lib/member-documents";
import {WorkflowError} from "@/lib/workflow";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();const text=await request.text();if(text.length>5000)throw new WorkflowError("Demande trop volumineuse.",413);let input:unknown;try{input=JSON.parse(text);}catch{throw new WorkflowError("Formulaire illisible.");}return Response.json(await closeMemberDocument(actor.id,input));}catch(e){return errorResponse(e);}}
