import Link from "next/link";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { db } from "@/lib/db";
import { Shell,Heading } from "@/components/shell";
import { redirect } from "next/navigation";
export default async function Institutions({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));const params=await searchParams;const q=(params.q??"").trim().slice(0,120);const page=Math.max(1,Math.min(100000,Number.parseInt(params.page??"1")||1));const where={ownerId:actor.id,...(q?{OR:[{name:{contains:q}},{branch:{contains:q}},{contactName:{contains:q}}]}:{})};
 const [items,count]=await Promise.all([db.financeInstitution.findMany({where,orderBy:{name:"asc"},skip:(page-1)*20,take:20}),db.financeInstitution.count({where})]);
 return <Shell name={actor.name} finance><Heading eyebrow="FINANCE" title="Institutions"><Link className="button" href="/finance/institutions/nouveau">Ajouter une institution</Link></Heading><section className="panel"><form className="filters"><label>Rechercher<input name="q" type="search" defaultValue={q} placeholder="Institution, agence ou interlocuteur"/></label><button className="button">Rechercher</button><Link href="/finance/institutions" className="text-link">Effacer</Link></form><h2>{count} institution{count!==1?"s":""}</h2><div className="registry">{items.map(i=><article key={i.id} className="registry-row"><div><h3>{i.name}</h3><p>{i.branch}</p><p className="muted small">{[i.contactName,i.contactRole].filter(Boolean).join(" · ")}</p></div><Link className="text-link" href={`/finance/institutions/${i.id}`}>Ouvrir la fiche →</Link></article>)}{!items.length&&<p className="empty-text">Aucune institution trouvée.</p>}</div><div className="actions">{page>1&&<Link className="text-link" href={`?${new URLSearchParams({q,page:String(page-1)})}`}>Précédent</Link>}{page*20<count&&<Link className="text-link" href={`?${new URLSearchParams({q,page:String(page+1)})}`}>Suivant</Link>}</div></section></Shell>;
}
