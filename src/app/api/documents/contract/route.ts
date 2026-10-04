import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {depositContract,MAX_CONTRACT_SIZE,MAX_CONTRACT_FILE_SIZE} from "@/lib/documents";
import {WorkflowError} from "@/lib/workflow";
export const runtime="nodejs";
export async function POST(request:Request){try{
 checkOrigin(request);const actor=await sessionActor();const size=Number(request.headers.get("content-length"));
 if(!size||size>MAX_CONTRACT_SIZE+131072)throw new WorkflowError("Dépôt limité à 200 Mo au total.",413);
 const data=await request.formData();const files=data.getAll("files");
 if(!files.length||files.length>10||files.some(f=>!(f instanceof File)||f.size>MAX_CONTRACT_FILE_SIZE))throw new WorkflowError("Choisissez de 1 à 10 fichiers de 20 Mo maximum chacun.");
 const uploads=await Promise.all((files as File[]).map(async f=>({name:f.name,buffer:Buffer.from(await f.arrayBuffer())})));
 return Response.json(await depositContract(actor.id,{fileId:data.get("fileId")||undefined,version:Number(data.get("version")),token:data.get("token"),...(data.get("replaceId")?{replaceId:data.get("replaceId")}:{})},uploads));
}catch(e){return errorResponse(e);}}
