import Link from "next/link";
import {redirect} from "next/navigation";
import {db} from "@/lib/db";
import {pageActor} from "@/lib/session";
import {homeForRole} from "@/lib/roles";
import {Shell,Heading} from "@/components/shell";
export default async function Loans({searchParams}:{searchParams:Promise<{page?:string}>}){
 const actor=await pageActor(),owner=actor.role==="FINANCE_OFFICER",control=["FINANCE_REVIEWER","FINANCE_VALIDATOR"].includes(actor.role),legal=actor.role==="LEGAL_OFFICER";
 if(!owner&&!control&&!legal)redirect(homeForRole(actor.role));
 const query=await searchParams,page=Math.max(1,Math.min(100000,Number.parseInt(query.page??"1",10)||1));
 const access=owner?{ownerId:actor.id}:legal?{legalOfficerId:actor.id}:actor.role==="FINANCE_REVIEWER"?{reviewerId:actor.id}:{validatorId:actor.id};
 const cases=await db.financeCase.findMany({where:{...access,OR:[{status:"INTERNALLY_VALIDATED"},{loans:{some:{}}}]},include:{loans:{include:{_count:{select:{events:{where:{status:"PENDING"}}}}}}},orderBy:[{updatedAt:"desc"},{id:"desc"}],skip:(page-1)*30,take:31});
 return <Shell name={actor.name} finance={owner} control={control} legal={legal}><Heading eyebrow="Finance" title="Suivi des prêts" description="Décisions du prêteur, échéances et opérations justifiées."/><section className="panel">{cases.length?<div className="table-scroll"><table><thead><tr><th>Dossier</th><th>Demandeur</th><th>Financements</th><th>À contrôler</th></tr></thead><tbody>{cases.slice(0,30).map(c=><tr key={c.id}><td><Link className="text-link" href={`/finance/${c.id}/prets`}>{c.reference}</Link></td><td>{c.applicantName}</td><td>{c.loans.length}</td><td>{c.loans.reduce((n,l)=>n+l._count.events,0)}</td></tr>)}</tbody></table></div>:<p>Aucun dossier disponible pour le suivi d’un prêt.</p>}<nav className="pagination" aria-label="Pagination">{page>1&&<Link href={`?page=${page-1}`}>Précédent</Link>}<span>Page {page}</span>{cases.length>30&&<Link href={`?page=${page+1}`}>Suivant</Link>}</nav></section></Shell>;
}
