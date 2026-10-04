import Link from "next/link";
import { redirect,notFound } from "next/navigation";
import { db } from "@/lib/db";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { getIncident } from "@/lib/incidents";
import { incidentStates,incidentUrgencies,incidentCategories,incidentChannels,progressLabels,type IncidentData,type IncidentState } from "@/lib/incident-model";
import { Shell,Heading } from "@/components/shell";
import { IncidentProgressForm } from "@/components/incident-forms";
export default async function Incident({params}:{params:Promise<{id:string}>}){
 const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));const item=await getIncident(actor.id,(await params).id).catch(()=>notFound());
 const data=item.data as unknown as IncidentData;const v=data.initial;
 const owners=await db.user.findMany({where:{role:"FINANCE_OFFICER",active:true,...(item.implicatedPersonId?{personId:{not:item.implicatedPersonId}}:{})},select:{id:true,name:true},orderBy:{name:"asc"}});
 const owner=await db.user.findUnique({where:{id:item.ownerId},select:{name:true}});
 const fields=[["Dossier",item.caseReference],["Auteur",v.reporter],["Contact",v.contact],["Canal",incidentChannels[v.channel]],["Catégorie",incidentCategories[v.category]],["Projet ou commande",v.project],["Description",v.description],["Références des preuves",v.evidence],["Montant",v.amount?`${v.amount} ${v.currency}`:""],["Collaborateur mis en cause",data.implicatedName]];
 return <Shell name={actor.name} finance><Link href="/finance/incidents">← Signalements</Link><Heading eyebrow={item.reference} title={item.title}><span className="status">{incidentStates[item.status as IncidentState]}</span></Heading><p>{incidentUrgencies[item.urgency as keyof typeof incidentUrgencies]} · Responsable : {owner?.name}</p><section className="panel"><h2>Signalement reçu</h2><p>Reçu le {item.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa"})}</p><dl className="revision-values">{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"Non renseigné"}</dd></div>)}</dl></section><section className="panel"><h2>Traitement</h2>{actor.id===item.ownerId?<><p className="muted">Les réponses sont consignées ici. Aucun message externe n’est envoyé.</p><IncidentProgressForm key={item.version} id={item.id} version={item.version} status={item.status as IncidentState} ownerId={item.ownerId} owners={owners} progress={data.progress}/></>:<dl className="revision-values">{Object.entries(progressLabels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{data.progress[key as keyof typeof data.progress]||"Non renseigné"}</dd></div>)}</dl>}</section><section className="panel"><h2>Historique du suivi</h2>{item.events.map(e=>{const snap=e.snapshot as unknown as {ownerName:string;data:IncidentData};return <details key={e.id} className="review-card"><summary>{incidentStates[e.action as IncidentState]} · {e.actorName} · {e.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa"})}</summary><p>{e.reason}</p><p>Responsable : {snap.ownerName}</p><dl className="revision-values">{Object.entries(progressLabels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{snap.data.progress[key as keyof typeof snap.data.progress]||"Non renseigné"}</dd></div>)}</dl></details>;})}</section></Shell>;
}
