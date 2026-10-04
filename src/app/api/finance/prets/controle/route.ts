import {sessionActor} from "@/lib/session";
import {checkOrigin,errorResponse} from "@/lib/http";
import {reviewLoanEvent} from "@/lib/loans";
export async function POST(request:Request){try{checkOrigin(request);const actor=await sessionActor();return Response.json(await reviewLoanEvent(actor.id,await request.json()));}catch(e){return errorResponse(e);}}
