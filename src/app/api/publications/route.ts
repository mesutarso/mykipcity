import { sessionActor } from "@/lib/session";
import { checkOrigin,errorResponse } from "@/lib/http";
import { WorkflowError } from "@/lib/workflow";
import { changePublication } from "@/lib/publications";
export const runtime="nodejs";
export async function POST(request:Request){
 try{
  checkOrigin(request);const actor=await sessionActor();
  if(Number(request.headers.get("content-length"))>50000)throw new WorkflowError("Contenu trop volumineux.",413);
  const text=await request.text();if(text.length>50000)throw new WorkflowError("Contenu trop volumineux.",413);
  let input:unknown;try{input=JSON.parse(text);}catch{throw new WorkflowError("Contenu illisible.");}
  return Response.json(await changePublication(actor.id,input));
 }catch(e){return errorResponse(e);}
}
