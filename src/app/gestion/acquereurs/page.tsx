import {RegistryCorrection} from "@/components/registry-correction";
import { homeForRole } from "@/lib/roles";
import Link from "next/link";
import { pageActor } from "@/lib/session";
import { requireStaff } from "@/lib/workflow";
import { db } from "@/lib/db";
import { Shell, Heading, Status } from "@/components/shell";
import { InvitationControls } from "@/components/forms";
import { redirect } from "next/navigation";
import { UsersRound, Mail, FolderCheck, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
const states = {DRAFT:"À compléter",SUBMITTED:"À examiner",NEEDS_INFO:"Complément demandé",VERIFIED:"Vérifiés",CLOSED:"Clôturés"};
export default async function Acquirers({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string;created?:string}>}) {
  const actor=await pageActor(); if(actor.role!=="ACQUIRER_AGENT")redirect(homeForRole(actor.role)); await requireStaff(actor.id);
  const params=await searchParams; const q=(params.q??"").trim().slice(0,120); const status=params.status??"";
  const page=Math.min(100000,Math.max(1,Number.parseInt(params.page??"1")||1));
  const where:Prisma.AcquirerWhereInput={mergedIntoId:null,
    ...(q?{OR:[{registeredName:{contains:q}},{email:{contains:q}},{reference:{contains:q}}]}:{}),
    ...(status==="INVITED"?{userId:null}:Object.hasOwn(states,status)?{file:{is:{status}}}:{})
  };
  const [records,total,count,pending,invited]=await Promise.all([
    db.acquirer.findMany({where,include:{file:{include:{_count:{select:{declarations:true,documents:true}}}},invitations:{where:{consumedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},orderBy:{createdAt:"desc"},take:1}},orderBy:{createdAt:"desc"},skip:(page-1)*20,take:20}),
    db.acquirer.count({where}),db.acquirer.count({where:{mergedIntoId:null}}),db.acquirerFile.count({where:{status:"SUBMITTED"}}),db.acquirer.count({where:{invitations:{some:{consumedAt:null,revokedAt:null,expiresAt:{gt:new Date()}}}}})
  ]);
  function pageUrl(n:number){return `/gestion/acquereurs?${new URLSearchParams({q,status,page:String(n)})}`;}
  return <Shell name={actor.name} staff><Heading title="Acquéreurs" eyebrow="GESTION"><Link href="/gestion/acquereurs/nouveau" className="button"><Plus size={17}/>Ajouter un acquéreur</Link><Link href="/gestion/imports" className="button secondary">Importer un CSV</Link><Link href="/gestion/historique-registre" className="text-link">Historique des corrections</Link></Heading>{params.created==="1"&&<p className="feedback success" role="status">Acquéreur enregistré. Vous pouvez créer son invitation.</p>}<div className="stats"><article><UsersRound/><span>Acquéreurs</span><strong>{count}</strong></article><article><FolderCheck/><span>À examiner</span><strong>{pending}</strong></article><article><Mail/><span>Invitations actives</span><strong>{invited}</strong></article></div><section className="panel"><form className="filters" action="/gestion/acquereurs"><label>Rechercher<input type="search" name="q" defaultValue={q} placeholder="Nom, référence ou e-mail" maxLength={120}/></label><label>État du dossier<select name="status" defaultValue={status}><option value="">Tous les dossiers</option><option value="INVITED">Compte non activé</option>{Object.entries(states).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><button className="button" type="submit">Rechercher</button><Link href="/gestion/acquereurs" className="text-link">Effacer</Link></form><div className="section-title"><h2>{total} acquéreur{total!==1?"s":""}</h2></div><div className="registry">{records.map(r=><article className="registry-row" key={r.id}><div className="registry-identity"><span className="avatar">{r.registeredName.slice(0,1)}</span><div><h3>{r.registeredName}</h3><p className="muted small">{r.reference} · {r.email}</p></div></div><RegistryCorrection key={r.registryVersion} id={r.id} version={r.registryVersion} kind="acquirer" name={r.registeredName} canMerge={!r.userId}/>{r.file?<div className="registry-state"><Status value={r.file.status}/><span className="muted small">{r.file._count.documents} document(s) · {r.file._count.declarations} parcelle(s)</span><Link href={`/gestion/acquereurs/${r.file.id}`} className="text-link">Ouvrir le dossier →</Link></div>:<InvitationControls acquirerId={r.id} invitationId={r.invitations[0]?.id}/>}</article>)}{!records.length&&<p className="empty-text">Aucun acquéreur trouvé.</p>}</div><div className="actions">{page>1&&<Link href={pageUrl(page-1)} className="button secondary compact">Précédent</Link>}{page*20<total&&<Link href={pageUrl(page+1)} className="button secondary compact">Suivant</Link>}</div></section></Shell>;
}
