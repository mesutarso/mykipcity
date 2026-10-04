import { changeReopening } from "@/lib/finance-reopening";
import { shareFinanceRequirement } from "@/lib/member-finance-documents";
import { manageMemberUpdate } from "@/lib/member-finance";
import { createIncident,updateIncident } from "@/lib/incidents";
import { saveAuthorization,changeAuthorization } from "@/lib/authorizations";
import { submitReview,decideReview } from "@/lib/finance-review";
import { saveInstitution,saveOffer } from "@/lib/institutions";
import { addRequirement,reviewFinanceDocument } from "@/lib/finance-documents";
import { sessionActor } from "@/lib/session";
import { checkOrigin,errorResponse } from "@/lib/http";
import { createFinanceCase,saveFinanceForm } from "@/lib/finance";
import { WorkflowError } from "@/lib/workflow";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){
  try{checkOrigin(request);const actor=await sessionActor();
    if(Number(request.headers.get("content-length"))>100000)throw new WorkflowError("Formulaire trop volumineux.",413);
    const text=await request.text();if(text.length>100000)throw new WorkflowError("Formulaire trop volumineux.",413);
    let input:unknown;try{input=JSON.parse(text);}catch{throw new WorkflowError("Formulaire illisible.");}
    const {action}=await params;
    if(action==="reopening")return Response.json(await changeReopening(actor.id,input));
    if(action==="share-requirement")return Response.json(await shareFinanceRequirement(actor.id,input));
    if(action==="member-update")return Response.json(await manageMemberUpdate(actor.id,input));
    if(action==="incident-create")return Response.json(await createIncident(actor.id,input));
    if(action==="incident-update")return Response.json(await updateIncident(actor.id,input));
    if(action==="authorization")return Response.json(await saveAuthorization(actor.id,input));
    if(action==="authorization-state")return Response.json(await changeAuthorization(actor.id,input));
    if(action==="submit-review")return Response.json(await submitReview(actor.id,input));
    if(action==="decide-review")return Response.json(await decideReview(actor.id,input));
    if(action==="institution")return Response.json(await saveInstitution(actor.id,input));
    if(action==="offer")return Response.json(await saveOffer(actor.id,input));
    if(action==="require-document")return Response.json(await addRequirement(actor.id,input));
    if(action==="review-document"){await reviewFinanceDocument(actor.id,input);return Response.json({success:true});}
    if(action==="create")return Response.json(await createFinanceCase(actor.id,input));
    if(action==="save")return Response.json(await saveFinanceForm(actor.id,input));
    throw new WorkflowError("Action inconnue.",404);
  }catch(error){return errorResponse(error);}
}
