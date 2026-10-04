import { sessionActor } from "@/lib/session";
import { checkOrigin,errorResponse } from "@/lib/http";
import { WorkflowError } from "@/lib/workflow";
import { updateProfile } from "@/lib/profile";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();if(Number(request.headers.get("content-length"))>5000)throw new WorkflowError("Formulaire trop volumineux.",413);const text=await request.text();if(text.length>5000)throw new WorkflowError("Formulaire trop volumineux.",413);let input:unknown;try{input=JSON.parse(text);}catch{throw new WorkflowError("Formulaire illisible.");}return Response.json(await updateProfile(actor.id,input));}catch(e){return errorResponse(e);}}
