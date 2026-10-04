import { OpportunityForm } from "@/components/opportunity-form";
import { opportunitySchema, opportunityDocuments } from "@/lib/opportunity-model";
import Link from "next/link";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { financeCase } from "@/lib/finance";
import { db } from "@/lib/db";
import { Shell,Heading } from "@/components/shell";
import { requestSchema,budgetSchema,categories,periods,money,minorUnits,qualities,needs,situations,pathways,proofs } from "@/lib/finance-model";
import { BudgetSummary } from "@/components/finance-forms";
import { redirect,notFound } from "next/navigation";
export default async function Revision({params}:{params:Promise<{id:string;version:string}>}){
 const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));const p=await params;
 const item=await financeCase(actor.id,p.id).catch(()=>notFound());const version=Number(p.version);if(!Number.isInteger(version)||version<1)notFound();
 const rev=await db.financeRevision.findUnique({where:{caseId_version:{caseId:item.id,version}},include:{actor:{select:{name:true}}}});if(!rev)notFound();
 const req=rev.code==="FIN-F01"?requestSchema.parse(rev.payload):null;const budget=rev.code==="FIN-F02"?budgetSchema.parse(rev.payload):null;
 const opportunity=rev.code==="FIN-F07"?opportunitySchema.parse(rev.payload):null;
 const documentProofs=opportunity?await db.financeDocument.findMany({where:{id:{in:opportunityDocuments(opportunity)},requirement:{caseId:item.id}}},):[];
 const values=req?[
 ["Demandeur",req.applicantName],["Qualité",qualities[req.quality]],["Référence acquéreur",req.acquirerReference],["Téléphone",req.phone],["E-mail",req.email],["Parcours",pathways[req.pathway]],["Besoin",needs[req.need]],["Autre besoin",req.otherNeed],["Projet ou parcelles",req.project],["Description",req.description],["Calendrier",req.calendar],
 ["Coût estimé",req.projectCost?money(minorUnits(req.projectCost),req.projectCurrency):""],["Apport",req.contribution?money(minorUnits(req.contribution),req.contributionCurrency):""],["Montant recherché",req.requested?money(minorUnits(req.requested),req.requestedCurrency):""],["Situation bancaire",situations[req.situation]],["Institution",req.institution],["Interlocuteur",req.contact],["Prochain contact",req.nextContact],["Pièces disponibles",req.initialDocuments]]:[];
 return <Shell name={actor.name} finance><Link href={`/finance/${item.id}?tab=historique`} className="text-link">← Historique du dossier</Link><Heading eyebrow={item.reference} title={`${rev.code} · Version ${rev.version}`} description={`${rev.actor.name} · ${rev.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa"})}`}/><section className="panel"><span className="status">Archive de brouillon · Lecture seule</span>{opportunity&&<OpportunityForm initial={opportunity} readOnly documents={documentProofs.map(d=>({id:d.id,label:`${d.originalName} · v${d.revision}`}))}/ >}{req&&<dl className="revision-values">{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"Non renseigné"}</dd></div>)}</dl>}{budget&&<><dl><dt>Date de situation</dt><dd>{budget.situationDate||"Non renseignée"}</dd><dt>Personnes à charge</dt><dd>{budget.dependents}</dd></dl>{budget.lines.map((line,i)=><article className="budget-line" key={i}><h3>{categories[line.category]}</h3><p>{money(minorUnits(line.amount),line.currency)} · {periods[line.period]}</p><p>{proofs[line.proof]}</p><p>{line.evidence||"Sans référence de justificatif"}</p><p>{line.stability}</p></article>)}<dl className="revision-values">{[["Source des conditions",budget.installmentSource],["Scénario défavorable",budget.stressScenario],["Risques",budget.risks],["Notes de l’analyste",budget.analystNotes]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"Non renseigné"}</dd></div>)}</dl></>}</section>{budget&&<BudgetSummary budget={budget}/>}</Shell>;
}
