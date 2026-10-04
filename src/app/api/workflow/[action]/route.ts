import {manageParcelAccess} from "@/lib/parcel-access";
import { registerAcquirer, registerParcel, sendMessage } from "@/lib/management";
import { z } from "zod";
import { activateInvitation, createInvitation, revokeInvitation, saveDossier, submitDossier, reviewDeclaration, WorkflowError } from "@/lib/workflow";
import { sessionActor } from "@/lib/session";
import { checkOrigin, errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length")) > 32768) throw new WorkflowError("Demande trop volumineuse.", 413);
    const text = await request.text();
    if (text.length > 32768) throw new WorkflowError("Demande trop volumineuse.", 413);
    const body: unknown = JSON.parse(text);
    const { action } = await params;
    if (action === "activate") return Response.json(await activateInvitation(body));
    const actor = await sessionActor();
    if (action === "parcel-access") return Response.json(await manageParcelAccess(actor.id,body));
    if (action === "register-acquirer") return Response.json(await registerAcquirer(actor.id, body));
    if (action === "register-parcel") return Response.json(await registerParcel(actor.id, body));
    if (action === "message") { await sendMessage(actor.id, body); return Response.json({ success: true }); }
    if (action === "invite") {
      const { acquirerId } = z.object({ acquirerId: z.string() }).strict().parse(body);
      return Response.json(await createInvitation(actor.id, acquirerId));
    }
    if (action === "revoke") {
      const { invitationId } = z.object({ invitationId: z.string() }).strict().parse(body);
      await revokeInvitation(actor.id, invitationId);
    } else if (action === "save") await saveDossier(actor.id, body);
    else if (action === "submit") {
      const { version, fileId } = z.object({ fileId: z.string().min(1).optional(), version: z.number().int().nonnegative(), accepted: z.literal(true) }).strict().parse(body);
      await submitDossier(actor.id, version, fileId);
    } else if (action === "review") await reviewDeclaration(actor.id, body);
    else throw new WorkflowError("Action inconnue.", 404);
    return Response.json({ success: true });
  } catch (error) { return errorResponse(error); }
}
