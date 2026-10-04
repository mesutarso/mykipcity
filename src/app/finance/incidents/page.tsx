import Link from "next/link";
import { redirect } from "next/navigation";
import { pageActor } from "@/lib/session";
import { db } from "@/lib/db";
import { homeForRole } from "@/lib/roles";
import { incidentAccess } from "@/lib/incidents";
import { incidentStates,incidentUrgencies,type IncidentData } from "@/lib/incident-model";
import { Shell,Heading } from "@/components/shell";
export default async function Incidents({searchParams}:{searchParams:Promise<{q?:string;status?:string;urgent?:string;page?:string;recorded?:string;updated?:string}>}){
 const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));
 const p=await searchParams,q=(p.q??"").trim().slice(0,120),status=p.status&&p.status in incidentStates?p.status:"";const page=Math.max(1,Math.min(10000,parseInt(p.page??"1")||1));
 const where={...incidentAccess(actor),...(status?{status}:{}),...(p.urgent==="1"?{urgency:{not:"ORDINARY"}}:{}),OR:[{title:{contains:q}},{reference:{contains:q}},{caseReference:{contains:q}}]};
 const [items,count]=await Promise.all([db.financeIncident.findMany({where,orderBy:{updatedAt:"desc"},skip:(page-1)*20,take:20}),db.financeIncident.count({where})]);
 const today=new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Kinshasa"});
 const url=(n:number)=>`?${new URLSearchParams({q,status,urgent:p.urgent??"",page:String(n)})}`;
 return <Shell name={actor.name} finance><Heading eyebrow="FINANCE" title="Incidents et réclamations"><Link className="button" href="/finance/incidents/nouveau">Nouveau signalement</Link></Heading>{p.recorded&&<p className="feedback success" role="status">Signalement {p.recorded} enregistré et attribué.</p>}{p.updated&&<p className="feedback success" role="status">Suivi enregistré.</p>}<section className="panel"><form className="form-grid"><label>Rechercher<input name="q" defaultValue={q} placeholder="Objet ou référence"/></label><label>État<select name="status" defaultValue={status}><option value="">Tous les états</option>{Object.entries(incidentStates).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="check-label"><input type="checkbox" name="urgent" value="1" defaultChecked={p.urgent==="1"}/><span>Urgences uniquement</span></label><button className="button">Rechercher</button></form><h2>{count} signalement{count>1?"s":""}</h2>{items.map(i=>{const data=i.data as unknown as IncidentData;return <article className="review-card" key={i.id}><h3><Link href={`/finance/incidents/${i.id}`}>{i.title}</Link></h3><p>{i.reference}{i.caseReference?` · ${i.caseReference}`:""}</p><p><span className="status">{incidentStates[i.status as keyof typeof incidentStates]}</span> · {incidentUrgencies[i.urgency as keyof typeof incidentUrgencies]}</p>{data.progress.dueOn&&<p>{data.progress.dueOn<today&&!["CLOSED","RESOLVED"].includes(i.status)?"Échéance dépassée : ":"Prochaine échéance : "}{data.progress.dueOn.split("-").reverse().join("/")}</p>}</article>;})}{!items.length&&<p>Aucun signalement trouvé.</p>}<div className="actions">{page>1&&<Link href={url(page-1)}>Précédent</Link>}{page*20<count&&<Link href={url(page+1)}>Suivant</Link>}</div></section></Shell>;
}
