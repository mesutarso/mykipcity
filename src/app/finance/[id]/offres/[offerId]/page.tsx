import Link from "next/link";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { db } from "@/lib/db";
import { financeCase } from "@/lib/finance";
import { Shell,Heading } from "@/components/shell";
import { OfferForm } from "@/components/institution-forms";
import { offerSchema,offerFields,offerValidity,rateMethods } from "@/lib/institution-model";
import { minorUnits,money } from "@/lib/finance-model";
import { redirect,notFound } from "next/navigation";
export default async function Offer({params,searchParams}:{params:Promise<{id:string;offerId:string}>;searchParams:Promise<{version?:string}>}){
 const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));const p=await params;const query=await searchParams;
 const item=await financeCase(actor.id,p.id).catch(()=>notFound());
 const offer=await db.financeOffer.findFirst({where:{id:p.offerId,caseId:item.id},include:{revisions:{orderBy:{version:"desc"}}}});if(!offer)notFound();
 const selected=query.version?offer.revisions.find(r=>r.version===Number(query.version)):null;if(query.version&&!selected)notFound();
 const data=offerSchema.parse(selected?selected.data:offer.data);const snapshot=offer.institutionSnapshot as {name:string;branch:string;contactName:string;contactRole:string;email:string;phone:string};
 const docs=await db.financeDocument.findMany({where:{requirement:{caseId:item.id},status:"ACCEPTED"},include:{requirement:true}});
 const documents=docs.filter(d=>d.revision===d.requirement.version).map(d=>({id:d.id,name:`${d.originalName} · v${d.revision}`}));
 if(data.documentId&&!documents.some(d=>d.id===data.documentId))documents.push({id:data.documentId,name:"Pièce précédente — à remplacer"});
 const values=[["Produit",data.product],["Montant",data.amount?money(minorUnits(data.amount),data.currency):""],["Durée",data.durationMonths?`${data.durationMonths} mois`:""],["Méthode de taux",rateMethods[data.rateMethod]],["Date de réponse",data.responseDate],["Valable jusqu’au",data.validUntil],["Auteur",data.author],["Référence écrite",data.writtenReference],...Object.entries(offerFields).map(([key,label])=>[label,data[key as keyof typeof offerFields]])];
 return <Shell name={actor.name} finance><Link className="text-link" href={`/finance/${item.id}?tab=offres`}>← Offres du dossier</Link><Heading eyebrow={item.reference} title={data.product}><span className="status">{selected?`Archive · v${selected.version}`:offerValidity(data)}</span></Heading><section className="panel"><h2>{snapshot.name}</h2><p>{[snapshot.branch,snapshot.contactName,snapshot.contactRole].filter(Boolean).join(" · ")}</p><p className="muted">{[snapshot.email,snapshot.phone].filter(Boolean).join(" · ")}</p><p className="muted small">Coordonnées conservées lors de l’enregistrement de l’offre.</p></section><section className="panel finance-form">{selected||item.status!=="DRAFT"?<><dl className="revision-values">{values.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"Non renseigné"}</dd></div>)}</dl>{data.documentId&&<Link className="text-link" href={`/api/finance/documents/${data.documentId}`}>Télécharger la pièce associée ↓</Link>}</>:<OfferForm key={offer.version} caseId={item.id} id={offer.id} version={offer.version} institutionId={offer.institutionId} institutions={[{id:offer.institutionId,name:snapshot.name,branch:snapshot.branch}]} documents={documents} initial={data}/>}</section><section className="panel"><h2>Historique de l’offre</h2>{selected&&<Link className="text-link" href={`/finance/${item.id}/offres/${offer.id}`}>Revenir à la version actuelle</Link>}<ol className="timeline">{offer.revisions.map(r=><li key={r.id}><Link className="text-link" href={`?version=${r.version}`}>Version {r.version}</Link><time dateTime={r.createdAt.toISOString()}>{r.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa",dateStyle:"short",timeStyle:"short"})}</time></li>)}</ol></section></Shell>;
}
