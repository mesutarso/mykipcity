import { sessionActor } from "@/lib/session";
import { checkOrigin, errorResponse } from "@/lib/http";
import { depositDocument, MAX_FILE_SIZE } from "@/lib/documents";
import { WorkflowError } from "@/lib/workflow";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await sessionActor();
    const size = Number(request.headers.get("content-length"));
    if (!size || size > MAX_FILE_SIZE + 65536) throw new WorkflowError("Dépôt limité à 8 Mo.", 413);
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || file.size > MAX_FILE_SIZE) throw new WorkflowError("Choisissez un fichier de 8 Mo maximum.");
    await depositDocument(actor.id, file.name, Buffer.from(await file.arrayBuffer()),data.has("metadata")?JSON.parse(String(data.get("metadata"))):undefined,String(data.get("fileId")||"")||undefined);
    return Response.json({ success: true });
  } catch (error) { return errorResponse(error); }
}
