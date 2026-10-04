import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {WorkflowError} from "@/lib/workflow";
import {prepareAcquirerChange,decideAcquirerChange,selectAcquirerFile} from "@/lib/acquirer-changes";
export async function POST(request:Request){try{
  checkOrigin(request);const actor=await sessionActor();const text=await request.text();
  if(text.length>10000)throw new WorkflowError("Demande trop volumineuse.",413);
  const {action,...input}=JSON.parse(text);
  if(action==="prepare")return Response.json(await prepareAcquirerChange(actor.id,input));
  if(action==="decide")return Response.json(await decideAcquirerChange(actor.id,input));
  if(action==="select")return Response.json(await selectAcquirerFile(actor.id,input));
  throw new WorkflowError("Action inconnue.",404);
}catch(e){return errorResponse(e);}}
