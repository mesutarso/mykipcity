import {contactQueue} from "@/lib/management";
import {Pagination} from "@/components/pagination";
import { homeForRole } from "@/lib/roles";
import Link from "next/link";
import { pageActor } from "@/lib/session";
import { db } from "@/lib/db";
import { Shell,Heading } from "@/components/shell";
import { redirect } from "next/navigation";
export default async function Messages({searchParams}:{searchParams:Promise<{page?:string;scope?:string}>}){
  const actor=await pageActor();if(actor.role!=="ACQUIRER_AGENT")redirect(homeForRole(actor.role));
  const page=Math.max(1,Math.min(100000,Number.parseInt((await searchParams).page??"1")||1));
  const scope=(await searchParams).scope??"mine";const file=await contactQueue(actor.id,scope);
  const total=await db.message.count({where:{file,author:{role:"ACQUIRER"}}});
  const messages=await db.message.findMany({where:{file,author:{role:"ACQUIRER"}},include:{author:{select:{name:true}},file:{select:{acquirer:{select:{reference:true}}}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:25,skip:(page-1)*25});
  return <Shell name={actor.name} staff><Heading title="Messages reçus" eyebrow="ACQUÉREURS"/><nav className="finance-tabs"><Link href="?scope=mine">Mes conversations</Link><Link href="?scope=unassigned">À attribuer</Link><Link href="?scope=all">Toute l’équipe</Link></nav><section className="panel">{messages.map(m=><article className="inbox-row" key={m.id}><div className="section-title"><h2>{m.author.name}</h2><time className="small muted" dateTime={m.createdAt.toISOString()}>{m.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa",dateStyle:"short",timeStyle:"short"})}</time></div>{m.subject&&<h3>{m.subject}</h3>}{m.parcelReference&&<p className="small muted">Parcelle {m.parcelReference}</p>}<p className="message-preview">{m.body}</p><Link className="text-link" href={`/gestion/acquereurs/${m.fileId}#echanges`}>{m.file.acquirer.reference} · Ouvrir la conversation →</Link></article>)}{!messages.length&&<p className="empty-text">Aucun message reçu.</p>}<Pagination page={page} total={total} size={25} params={{scope}}/></section></Shell>;
}
