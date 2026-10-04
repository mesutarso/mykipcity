import Link from "next/link";
import { redirect } from "next/navigation";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { db } from "@/lib/db";
import { Shell,Heading } from "@/components/shell";
import { publicationStates,publicationAudiences } from "@/lib/publication-model";
export default async function Publications({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){
 const actor=await pageActor();if(actor.role!=="ACQUIRER_AGENT")redirect(homeForRole(actor.role));
 const p=await searchParams;const status=p.status&&Object.hasOwn(publicationStates,p.status)?p.status:"";const page=Math.max(1,Math.min(100000,parseInt(p.page??"1")||1));const where=status?{status}:{};
 const [items,count]=await Promise.all([db.memberPublication.findMany({where,orderBy:{updatedAt:"desc"},take:20,skip:(page-1)*20}),db.memberPublication.count({where})]);
 return <Shell staff name={actor.name}><Heading eyebrow="MYKIPCITY" title="Publications"><Link href="/gestion/publications/nouveau" className="button">Nouvelle publication</Link></Heading><section className="panel"><form className="filters"><label>État<select name="status" defaultValue={status}><option value="">Tous les états</option>{Object.entries(publicationStates).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><button className="button">Filtrer</button></form>{items.map(item=><article className="registry-row" key={item.id}><div><h2><Link href={`/gestion/publications/${item.id}`}>{item.title}</Link></h2><p className="muted">{publicationAudiences[item.audience as keyof typeof publicationAudiences]}{item.targetReference&&` · ${item.targetReference}`}</p></div><div><span className="status">{item.status==="PUBLISHED"&&item.publishedAt&&item.publishedAt>new Date()?"Programmé":publicationStates[item.status]}</span><p className="small muted">Version {item.version}</p></div></article>)}{!items.length&&<p className="empty-text">Aucune publication.</p>}<div className="actions">{page>1&&<Link className="button secondary" href={`?status=${status}&page=${page-1}`}>Précédent</Link>}{page*20<count&&<Link className="button secondary" href={`?status=${status}&page=${page+1}`}>Suivant</Link>}</div></section></Shell>;
}
