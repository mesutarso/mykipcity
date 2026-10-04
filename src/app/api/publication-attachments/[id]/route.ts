import { sessionActor } from "@/lib/session";
import { errorResponse } from "@/lib/http";
import { readPublicationAttachment } from "@/lib/publication-attachments";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await sessionActor();const {file,bytes}=await readPublicationAttachment(actor.id,(await params).id,new URL(request.url).searchParams.get("archive")==="1");const inline=file.mimeType.startsWith("image/")&&!new URL(request.url).searchParams.has("download");return new Response(new Uint8Array(bytes),{headers:{"Content-Type":inline?file.mimeType:"application/octet-stream","Content-Disposition":`${inline?"inline":"attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,"X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox","Cache-Control":"private, no-store"}});}catch(e){return errorResponse(e);}}
