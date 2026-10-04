import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {requestEmailChange,confirmEmailChange} from "@/lib/email-change";
import {WorkflowError} from "@/lib/workflow";
export async function POST(request:Request){try{checkOrigin(request);const raw=await request.text();if(raw.length>2000)throw new WorkflowError("Formulaire trop volumineux.",413);const input=JSON.parse(raw);return Response.json(new URL(request.url).searchParams.get("confirm")==="1"?await confirmEmailChange(input):await requestEmailChange((await sessionActor()).id,input));}catch(e){return errorResponse(e);}}
