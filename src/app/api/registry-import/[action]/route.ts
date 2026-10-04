import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {previewRegistryImport,confirmRegistryImport} from "@/lib/registry-import";
import {WorkflowError} from "@/lib/workflow";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){try{
 checkOrigin(request);const actor=await sessionActor();if(Number(request.headers.get("content-length"))>1600000)throw new WorkflowError("Fichier trop volumineux.",413);
 const text=await request.text();if(Buffer.byteLength(text)>1600000)throw new WorkflowError("Fichier trop volumineux.",413);
 let input:unknown;try{input=JSON.parse(text);}catch{throw new WorkflowError("Demande illisible.");}
 const {action}=await params;if(action==="preview")return Response.json(await previewRegistryImport(actor.id,input));if(action==="confirm")return Response.json(await confirmRegistryImport(actor.id,input));throw new WorkflowError("Action inconnue.",404);
}catch(e){return errorResponse(e);}}
