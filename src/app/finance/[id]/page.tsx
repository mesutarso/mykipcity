import { OpportunityForm } from "@/components/opportunity-form";
import { opportunitySchema } from "@/lib/opportunity-model";
import { db } from "@/lib/db";
import { MemberFinancePublication } from "@/components/member-finance-publication";
import { Authorizations } from "@/components/authorizations";
import { ReviewPanel } from "@/components/review-panel";
import { AssignmentHistory } from "@/components/assignment-history";
import { FinanceOffers } from "@/components/finance-offers";
import { FinanceDocumentList } from "@/components/finance-document-list";
import Link from "next/link";
import { pageActor } from "@/lib/session";
import { homeForRole,financeStates } from "@/lib/roles";
import { financeCase } from "@/lib/finance";
import { WorkflowError } from "@/lib/workflow";
import { requestSchema,budgetSchema } from "@/lib/finance-model";
import { Shell,Heading } from "@/components/shell";
import { RequestForm,BudgetForm,BudgetSummary } from "@/components/finance-forms";
import { redirect,notFound } from "next/navigation";
export default async function Case({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string;saved?:string}>}){
  const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));
  const item=await financeCase(actor.id,(await params).id).catch(e=>{if(e instanceof WorkflowError&&e.status===404)notFound();throw e;});
  const query=await searchParams;const tab=query.tab==="opportunite"?"opportunite":query.tab==="acquereur"?"acquereur":query.tab==="autorisations"?"autorisations":query.tab==="controle"?"controle":query.tab==="offres"?"offres":query.tab==="pieces"?"pieces":query.tab==="budget"?"budget":query.tab==="historique"?"historique":"demande";
  const request=requestSchema.parse(item.request);const budget=item.budget?budgetSchema.parse(item.budget):undefined;
  const requirements=tab==="opportunite"?await db.financeRequirement.findMany({where:{caseId:item.id},include:{documents:true}}):[];
  const documents=requirements.flatMap(r=>r.documents.filter(d=>d.revision===r.version&&d.status==="ACCEPTED").map(d=>({id:d.id,label:`${r.label} · ${d.originalName} · v${d.revision}`})));
  return <Shell name={actor.name} finance><Link href="/finance" className="text-link">← Dossiers financiers</Link><Heading eyebrow={item.reference} title={item.applicantName}><span className="status">{financeStates[item.status]??item.status} · version {item.version}</span></Heading><p className="muted small">Référent : {item.owner.name}{request.nextContact?` · Prochain contact : ${request.nextContact.split("-").reverse().join("/")}`:""}</p><nav className="finance-tabs" aria-label="Dossier financier">{[["demande","Demande"],["budget","Budget"],["opportunite","Opportunité"],["pieces","Pièces"],["offres","Offres"],["controle","Validation"],["autorisations","Autorisations"],["acquereur","Suivi acquéreur"],["historique","Historique"]].map(([key,label])=><Link key={key} aria-current={tab===key?"page":undefined} href={`/finance/${item.id}?tab=${key}`}>{label}</Link>)}<Link href={`/finance/${item.id}/prets`}>Prêts et échéances</Link><Link href={`/juridique/${item.id}`}>Juridique</Link></nav>{query.saved==="1"&&<p className="feedback success" role="status">Modifications enregistrées.</p>}{tab==="opportunite"?<section className="panel"><OpportunityForm key={item.version} id={item.id} version={item.version} initial={item.opportunity?opportunitySchema.parse(item.opportunity):undefined} documents={documents} readOnly={item.status!=="DRAFT"}/></section>:tab==="acquereur"?<MemberFinancePublication caseId={item.id} userId={actor.id}/>:tab==="autorisations"?<Authorizations caseId={item.id} userId={actor.id}/>:tab==="controle"?<ReviewPanel item={item}/>:tab==="offres"?<FinanceOffers caseId={item.id} userId={actor.id}/>:tab==="pieces"?<FinanceDocumentList caseId={item.id} userId={actor.id}/>:tab==="demande"?<section className="panel finance-form"><RequestForm readOnly={item.status!=="DRAFT"} key={item.version} initial={request} id={item.id} version={item.version}/></section>:tab==="budget"?<div className="finance-layout"><section className="panel"><BudgetForm readOnly={item.status!=="DRAFT"} key={item.version} initial={budget} id={item.id} version={item.version}/></section>{budget&&<BudgetSummary budget={budget}/>}</div>:<section className="panel"><h2>Historique des versions</h2><ol className="timeline">{item.revisions.map(r=><li key={r.id}><Link className="text-link" href={`/finance/${item.id}/historique/${r.version}`}>{r.code} · Version {r.version}</Link><span>{r.actor.name}</span><time dateTime={r.createdAt.toISOString()}>{r.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa",dateStyle:"short",timeStyle:"short"})}</time></li>)}</ol><AssignmentHistory caseId={item.id} userId={actor.id}/></section>}<p className="signature-note">Déclaration non signée. La signature du demandeur et le visa de l’analyste restent distincts.</p></Shell>;
}
