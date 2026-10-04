import Link from "next/link";
import {redirect} from "next/navigation";
import {db} from "@/lib/db";
import {pageActor} from "@/lib/session";
import {homeForRole} from "@/lib/roles";
import {Shell,Heading} from "@/components/shell";
import {AcquirerChangeForm} from "@/components/acquirer-change-forms";
export default async function Changes({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const actor=await pageActor();if(actor.role!=="ACQUIRER_AGENT")redirect(homeForRole(actor.role));const p=await searchParams,q=(p.q??"").trim().slice(0,100),page=Math.max(1,Math.min(10000,Math.floor(Number(p.page)||1)));
 const [files,items,count]=await Promise.all([
  db.acquirerFile.findMany({where:{acquirer:{mergedIntoId:null,user:{active:true,role:"ACQUIRER"},...(q?{OR:q.split(",").map(term=>term.trim()).filter(Boolean).flatMap(term=>[{reference:{contains:term}},{registeredName:{contains:term}}])}:{})}},include:{acquirer:true,documents:{where:{isCurrent:true}},declarations:true},orderBy:{id:"asc"},take:100}),
  db.acquirerChange.findMany({orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(page-1)*20,take:20}),db.acquirerChange.count(),
 ]);
 return <Shell name={actor.name} staff><Heading eyebrow="ACQUÉREURS" title="Regroupements et changements de titulaire" description="Chaque opération nécessite des preuves et la décision d’une seconde personne."/><section className="panel"><h2>Préparer une demande</h2><form className="filters"><label>Rechercher des dossiers<input name="q" defaultValue={q} placeholder="Nom ou références séparées par une virgule" maxLength={100}/></label><button className="button secondary">Rechercher</button></form><p className="muted small">Les 100 premiers dossiers correspondant à la recherche sont proposés. Recherchez le nom commun ou les deux références séparées par une virgule.</p><AcquirerChangeForm key={q} files={files.map(f=>({id:f.id,label:`${f.acquirer.reference} · ${f.fullName||f.acquirer.registeredName}`,proofs:f.documents.map(d=>({id:d.id,name:d.originalName})),declarations:f.declarations.map(d=>({id:d.id,label:`${d.reference} · ${d.status==="APPROVED"?"Examinée":"À examiner"}`}))}))}/></section><section className="panel"><h2>Demandes et décisions</h2>{items.map(i=><article key={i.id} className="review-card"><Link href={`/gestion/changements/${i.id}`}>{i.kind==="CONSOLIDATE"?"Regroupement de comptes":"Changement de titulaire"}</Link><p>{i.reason}</p><p>{({PENDING:"À examiner",APPROVED:"Approuvé",REJECTED:"Refusé",CANCELLED:"Retiré"} as Record<string,string>)[i.status]}</p></article>)}{!items.length&&<p>Aucune demande.</p>}<nav className="actions" aria-label="Pages des demandes">{page>1&&<Link href={`?page=${page-1}&q=${encodeURIComponent(q)}`}>Précédent</Link>}{page*20<count&&<Link href={`?page=${page+1}&q=${encodeURIComponent(q)}`}>Suivant</Link>}</nav></section></Shell>;
}
