import { sessionActor } from "@/lib/session";
import { errorResponse } from "@/lib/http";
import { readMemberDocument } from "@/lib/member-documents";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await sessionActor();const {document,bytes}=await readMemberDocument(actor.id,(await params).id);return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/octet-stream","X-Content-Type-Options":"nosniff","Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,"Cache-Control":"private, no-store"}});}catch(e){return errorResponse(e);}}
