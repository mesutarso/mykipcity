import { reassignFinance, replaceValidator, replaceReviewer } from "@/lib/assignments";
import { sessionActor } from "@/lib/session";
import { checkOrigin, errorResponse } from "@/lib/http";
import { activateStaff, inviteStaff, manageStaffInvitation, updateStaff } from "@/lib/team";
import { WorkflowError } from "@/lib/workflow";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    const { action } = await params;
    const actor = action === "activate" ? null : await sessionActor();
    if (Number(request.headers.get("content-length")) > 10000) throw new WorkflowError("Formulaire trop volumineux.", 413);
    const text = await request.text();
    if (text.length > 10000) throw new WorkflowError("Formulaire trop volumineux.", 413);
    let input: unknown;
    try { input = JSON.parse(text); } catch { throw new WorkflowError("Formulaire illisible."); }
    if (action === "activate") return Response.json(await activateStaff(input));
    if (action === "replace-reviewer") return Response.json(await replaceReviewer(actor!.id, input));
    if (action === "replace-validator") return Response.json(await replaceValidator(actor!.id, input));
    if (action === "reassign") return Response.json(await reassignFinance(actor!.id, input));
    if (action === "invite") return Response.json(await inviteStaff(actor!.id, input));
    if (action === "invitation") return Response.json(await manageStaffInvitation(actor!.id, input));
    if (action === "update") return Response.json(await updateStaff(actor!.id, input));
    throw new WorkflowError("Action inconnue.", 404);
  } catch (error) { return errorResponse(error); }
}
