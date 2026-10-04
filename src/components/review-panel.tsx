import { ReopeningPanel } from "./reopening-panel";
import { db } from "@/lib/db";
import { SubmitReviewForm, ReviewDecisionForm } from "./review-forms";
import { ReviewSnapshot } from "./review-snapshot";
import { reviewActions } from "@/lib/finance-review";
export async function ReviewTimeline({caseId}:{caseId:string}) {
 const events=await db.financeReviewEvent.findMany({where:{caseId},orderBy:{createdAt:"desc"}});
 return <section className="panel"><h2>Historique des décisions</h2>{events.map(e=><article className="review-card" key={e.id}><h3>{reviewActions[e.action]} · Examen {e.cycle}</h3><p>{e.reason}</p><small>{e.actorName} · {e.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa"})}</small></article>)}{!events.length&&<p>Aucune décision enregistrée.</p>}</section>;
}
export async function ReviewPanel({item}:{item:{id:string;version:number;status:string}}){
 const people=await db.user.findMany({where:{active:true,role:{in:["FINANCE_REVIEWER","FINANCE_VALIDATOR"]}},select:{id:true,name:true,role:true},orderBy:{name:"asc"}});
 const snapshots=await db.financeReview.findMany({where:{caseId:item.id},orderBy:{cycle:"desc"}});
 return <><section className="panel"><h2>Validation interne</h2><p className="muted">Préparation → contrôle → validation. La signature et l’autorisation de transmission bancaire restent distinctes.</p>{item.status==="DRAFT"?<SubmitReviewForm id={item.id} version={item.version} reviewers={people.filter(p=>p.role==="FINANCE_REVIEWER")} validators={people.filter(p=>p.role==="FINANCE_VALIDATOR")}/>:item.status==="INTERNALLY_VALIDATED"?<p>La validation interne est enregistrée. Le dossier reste en lecture seule.</p>:<ReviewDecisionForm id={item.id} version={item.version} stage="withdraw"/>}</section><ReopeningPanel item={item}/><ReviewTimeline caseId={item.id}/>{snapshots.map(s=><details className="panel" key={s.id}><summary>Copie soumise · Examen {s.cycle}</summary><ReviewSnapshot snapshot={s.snapshot}/></details>)}</>;
}
