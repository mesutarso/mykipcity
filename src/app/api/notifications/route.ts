import { sessionActor } from "@/lib/session";
import { checkOrigin,errorResponse } from "@/lib/http";
import { markNotifications } from "@/lib/notifications";
import { WorkflowError } from "@/lib/workflow";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();const text=await request.text();if(text.length>25000)throw new WorkflowError("Demande trop volumineuse.",413);let input:unknown;try{input=JSON.parse(text);}catch{throw new WorkflowError("Demande illisible.");}return Response.json(await markNotifications(actor.id,input));}catch(e){return errorResponse(e);}}
