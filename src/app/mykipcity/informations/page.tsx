import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { memberPublications } from "@/lib/publications";
import { WorkflowError } from "@/lib/workflow";
import { Shell,Heading } from "@/components/shell";
import { PublicationCard } from "@/components/publication-card";
export default async function Information({searchParams}:{searchParams:Promise<{parcelle?:string;page?:string}>}){
 const actor=await pageActor();if(actor.role!=="ACQUIRER")redirect(homeForRole(actor.role));const p=await searchParams;const parcel=p.parcelle||undefined;const page=Math.max(1,Math.min(100000,parseInt(p.page??"1")||1));
 const data=await memberPublications(actor.id,parcel,page).catch(e=>{if(e instanceof WorkflowError&&e.status===404)notFound();throw e;});
 return <Shell name={actor.name}><Heading eyebrow="MYKIPCITY" title="Mes informations"><Link href="/mykipcity" className="text-link">Mon espace →</Link></Heading>{data.eligible?<><section className="panel"><form key={parcel??"all"} className="filters"><label>Parcelle<select name="parcelle" defaultValue={parcel??""}><option value="">Toutes mes parcelles</option>{data.parcels.map(p=><option key={p.id} value={p.id}>{p.reference}</option>)}</select></label><button className="button">Afficher</button></form>{data.items.length?<div className="stack">{data.items.map(item=><PublicationCard key={item.id} item={item}/>)}</div>:<p className="empty-text">Aucune information publiée pour le moment.</p>}<div className="actions">{page>1&&<Link className="button secondary" href={`?${new URLSearchParams({parcelle:parcel??"",page:String(page-1)})}`}>Précédent</Link>}{page*12<data.count&&<Link className="button secondary" href={`?${new URLSearchParams({parcelle:parcel??"",page:String(page+1)})}`}>Suivant</Link>}</div></section></>:<section className="panel"><p>Vos informations seront accessibles après validation d’un rattachement.</p><Link className="text-link" href="/mon-dossier">Consulter mon dossier →</Link></section>}</Shell>;
}
