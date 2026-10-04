import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { pageActor } from "@/lib/session";
import { homeForRole,financeStates } from "@/lib/roles";
import { Shell,Heading } from "@/components/shell";
export default async function Controls(){
 const actor=await pageActor();if(!["FINANCE_REVIEWER","FINANCE_VALIDATOR"].includes(actor.role))redirect(homeForRole(actor.role));
 const items=await db.financeCase.findMany({where:{...(actor.role==="FINANCE_REVIEWER"?{reviewerId:actor.id}:{validatorId:actor.id}),status:{in:["IN_REVIEW","IN_VALIDATION","INTERNALLY_VALIDATED"]}},select:{id:true,reference:true,applicantName:true,status:true,reopeningRequestId:true},orderBy:{updatedAt:"desc"},take:100});
 return <Shell name={actor.name} control><Heading eyebrow="FINANCE" title={actor.role==="FINANCE_REVIEWER"?"Dossiers à contrôler":"Dossiers à valider"}/><section className="panel"><h2>Dossiers attribués</h2>{items.map(item=><article className="registry-row" key={item.id}><div><h3>{item.applicantName}</h3><p>{item.reference}</p><span className="status">{item.reopeningRequestId?"Réouverture demandée":financeStates[item.status]}</span></div><Link href={`/finance/controles/${item.id}`} className="text-link">Examiner le dossier →</Link></article>)}{!items.length&&<p>Aucun dossier attribué.</p>}<p className="muted small">Les 100 derniers dossiers attribués.</p></section></Shell>;
}
