import Link from "next/link";
import {redirect} from "next/navigation";
import {pageActor} from "@/lib/session";
import {db} from "@/lib/db";
import {legalAccess} from "@/lib/legal";
import {homeForRole} from "@/lib/roles";
import {Shell,Heading} from "@/components/shell";
import {Pagination} from "@/components/pagination";
export default async function Page({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){const actor=await pageActor();if(!["LEGAL_OFFICER","FINANCE_OFFICER","FINANCE_REVIEWER","FINANCE_VALIDATOR"].includes(actor.role))redirect(homeForRole(actor.role));const params=await searchParams,q=(params.q??"").trim().slice(0,120),page=Math.max(1,Math.min(10000,parseInt(params.page??"1")||1)),where={...legalAccess(actor),reference:{contains:q}};const [items,total]=await Promise.all([db.financeCase.findMany({where,select:{id:true,reference:true,applicantName:true},orderBy:{updatedAt:"desc"},skip:(page-1)*20,take:20}),db.financeCase.count({where})]);return <Shell name={actor.name} legal={actor.role==="LEGAL_OFFICER"} finance={actor.role==="FINANCE_OFFICER"} control={["FINANCE_REVIEWER","FINANCE_VALIDATOR"].includes(actor.role)}><Heading eyebrow="CABINET JURIDIQUE" title="Dossiers juridiques"/><section className="panel"><form className="filters"><label>Référence du dossier<input name="q" defaultValue={q}/></label><button className="button">Rechercher</button></form>{items.map(i=><article className="registry-row" key={i.id}><div><h2>{i.reference}</h2><p>{i.applicantName}</p></div><Link className="text-link" href={`/juridique/${i.id}`}>Ouvrir →</Link></article>)}{!items.length&&<p>Aucun dossier attribué.</p>}<Pagination page={page} total={total} params={{q}}/></section></Shell>;}
