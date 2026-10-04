import Link from "next/link";
import { pageActor } from "@/lib/session";
import { homeForRole,financeStates } from "@/lib/roles";
import { db } from "@/lib/db";
import { Shell,Heading } from "@/components/shell";
import { pathways } from "@/lib/finance-model";
import { redirect } from "next/navigation";

export default async function Finance({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
  const actor=await pageActor();
  if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));
  const params=await searchParams;
  const q=(params.q??"").trim().slice(0,120);
  const page=Math.min(100000,Math.max(1,Number.parseInt(params.page??"1")||1));
  const where={ownerId:actor.id,...(q?{OR:[{reference:{contains:q}},{applicantName:{contains:q}}]}:{})};
  const [records,count,states]=await Promise.all([
    db.financeCase.findMany({where,orderBy:{updatedAt:"desc"},take:20,skip:(page-1)*20}),
    db.financeCase.count({where}),
    db.financeCase.groupBy({by:["status"],where:{ownerId:actor.id},_count:{_all:true}}),
  ]);
  const total=states.reduce((sum,row)=>sum+row._count._all,0);
  const drafts=states.find(row=>row.status==="DRAFT")?._count._all??0;
  const underReview=states.filter(row=>["IN_REVIEW","IN_VALIDATION"].includes(row.status)).reduce((sum,row)=>sum+row._count._all,0);
  return <Shell name={actor.name} finance>
    <Heading eyebrow="FINANCE · MES DOSSIERS" title="Votre activité Finance" description="Retrouvez vos dossiers et leur état d’avancement."><Link href="/finance/nouveau" className="button">Nouvelle demande</Link></Heading>
    <section className="finance-overview" aria-label="Synthèse de mes dossiers"><article><span>Dossiers attribués</span><strong>{total}</strong></article><article><span>À préparer</span><strong>{drafts}</strong></article><article><span>En contrôle ou validation</span><strong>{underReview}</strong></article></section>
    <section className="panel finance-results" aria-labelledby="results-title">
      <form className="filters" action="/finance"><label>Rechercher un dossier<input type="search" name="q" defaultValue={q} placeholder="Référence ou demandeur"/></label><button className="button">Rechercher</button>{q&&<Link href="/finance" className="text-link">Effacer</Link>}</form>
      <h2 id="results-title" className="results-heading">{q?"Résultats de recherche":"Mes dossiers"} <span className="muted">· {count}</span></h2>
      {records.length?<div className="table-scroll" role="region" aria-label="Liste des dossiers financiers" tabIndex={0}><table className="case-table"><thead><tr><th scope="col">Dossier / demandeur</th><th scope="col">Parcours</th><th scope="col">Étude interne</th><th scope="col">Mis à jour</th><th scope="col"><span className="visually-hidden">Action</span></th></tr></thead><tbody>{records.map(item=><tr key={item.id}>
        <td><Link className="case-name" href={`/finance/${item.id}`}>{item.applicantName}</Link><small>{item.reference}</small></td>
        <td>{pathways[item.pathway as keyof typeof pathways]}</td>
        <td><span className={`status ${item.status==="INTERNALLY_VALIDATED"?"positive":""}`}>{financeStates[item.status]??item.status}</span></td>
        <td><time dateTime={item.updatedAt.toISOString()}>{item.updatedAt.toLocaleDateString("fr-FR",{timeZone:"Africa/Kinshasa"})}</time></td>
        <td><Link href={`/finance/${item.id}`} className="text-link" aria-label={`Ouvrir le dossier ${item.reference}`}>Ouvrir ↗</Link></td>
      </tr>)}</tbody></table></div>:<p className="empty-text">{q?"Aucun dossier ne correspond à votre recherche.":"Vous n’avez pas encore de dossier attribué."}</p>}
      {(page>1||page*20<count)&&<div className="actions">{page>1&&<Link className="button secondary compact" href={`/finance?${new URLSearchParams({q,page:String(page-1)})}`}>Précédent</Link>}{page*20<count&&<Link className="button secondary compact" href={`/finance?${new URLSearchParams({q,page:String(page+1)})}`}>Suivant</Link>}</div>}
    </section>
  </Shell>;
}
