import {sessionActor} from "@/lib/session";
import {errorResponse} from "@/lib/http";
import {readMessageFile} from "@/lib/management";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await sessionActor();const file=await readMessageFile(actor.id,(await params).id);return new Response(new Uint8Array(file.bytes),{headers:{"Content-Type":"application/octet-stream","X-Content-Type-Options":"nosniff","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,"Cache-Control":"private, no-store"}});}catch(e){return errorResponse(e);}}
