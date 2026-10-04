import { ReopeningPanel } from "@/components/reopening-panel";
import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { db } from "@/lib/db";
import { pageActor } from "@/lib/session";
import { homeForRole,financeStates } from "@/lib/roles";
import { controlledCase } from "@/lib/finance-review";
import { Shell,Heading } from "@/components/shell";
import { ReviewSnapshot } from "@/components/review-snapshot";
import { ReviewTimeline } from "@/components/review-panel";
import { ReviewDecisionForm } from "@/components/review-forms";
export default async function Control({params}:{params:Promise<{id:string}>}){
 const actor=await pageActor();if(!["FINANCE_REVIEWER","FINANCE_VALIDATOR"].includes(actor.role))redirect(homeForRole(actor.role));
 const item=await controlledCase(actor.id,(await params).id).catch(()=>notFound());
 const cycle=await db.financeReview.findUniqueOrThrow({where:{caseId_cycle:{caseId:item.id,cycle:item.reviewCycle}}});
 const stage=actor.role==="FINANCE_REVIEWER"&&item.status==="IN_REVIEW"?"control":actor.role==="FINANCE_VALIDATOR"&&item.status==="IN_VALIDATION"?"validate":null;
 return <Shell name={actor.name} control><Link href="/finance/controles">← Dossiers attribués</Link><Heading eyebrow={item.reference} title={item.applicantName}><span className="status">{financeStates[item.status]}</span></Heading><p><Link className="text-link" href={`/finance/${item.id}/prets`}>Prêts et échéances →</Link></p><ReviewSnapshot snapshot={cycle.snapshot}/>{stage&&<section className="panel"><h2>{stage==="control"?"Résultat du contrôle":"Décision interne"}</h2><p className="muted">Cette décision interne n’autorise aucune transmission bancaire et ne constitue pas un accord de crédit.</p><ReviewDecisionForm key={item.version} id={item.id} version={item.version} stage={stage}/></section>}{actor.role==="FINANCE_VALIDATOR"&&<ReopeningPanel item={item} validator/>}<ReviewTimeline caseId={item.id}/></Shell>;
}
