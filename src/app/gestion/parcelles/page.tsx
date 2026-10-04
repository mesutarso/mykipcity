import {RegistryCorrection} from "@/components/registry-correction";
import {activeParcelWhere} from "@/lib/parcel-access-model";
import { homeForRole } from "@/lib/roles";
import Link from "next/link";
import { pageActor } from "@/lib/session";
import { db } from "@/lib/db";
import { Shell,Heading } from "@/components/shell";
import { redirect } from "next/navigation";
export default async function Parcels({searchParams}:{searchParams:Promise<{q?:string;page?:string;created?:string}>}){
  const actor=await pageActor();if(actor.role!=="ACQUIRER_AGENT")redirect(homeForRole(actor.role));
  const params=await searchParams;const q=(params.q??"").trim().slice(0,120);const page=Math.min(100000,Math.max(1,Number.parseInt(params.page??"1")||1));
  const where=q?{OR:[{reference:{contains:q}},{cadastralReference:{contains:q}}]}:{};
  const [parcels,count]=await Promise.all([db.parcel.findMany({where,include:{declarations:{where:activeParcelWhere(),include:{file:{include:{acquirer:true}}}}},orderBy:{reference:"asc"},take:20,skip:(page-1)*20}),db.parcel.count({where})]);
  return <Shell name={actor.name} staff><Heading title="Parcelles" eyebrow="REGISTRE"><Link href="/gestion/parcelles/nouveau" className="button">Ajouter une parcelle</Link><Link href="/gestion/imports" className="button secondary">Importer un CSV</Link><Link href="/gestion/historique-registre" className="text-link">Historique des corrections</Link></Heading>{params.created==="1"&&<p className="feedback success" role="status">Parcelle enregistrée.</p>}<section className="panel"><form className="filters" action="/gestion/parcelles"><label>Rechercher<input name="q" type="search" defaultValue={q} placeholder="Référence ou numéro cadastral" maxLength={120}/></label><button className="button">Rechercher</button><Link href="/gestion/parcelles" className="text-link">Effacer</Link></form><h2>{count} parcelle{count!==1?"s":""}</h2><div className="registry">{parcels.map(p=><article className="registry-row" key={p.id}><div><h3>{p.reference}</h3><p className="muted">{p.area.toLocaleString("fr-FR")} m² · {p.cadastralReference}</p><RegistryCorrection key={p.registryVersion} id={p.id} version={p.registryVersion} kind="parcel" area={p.area} cadastralReference={p.cadastralReference}/></div><div>{p.declarations.length?p.declarations.map(d=><Link key={d.id} className="text-link" href={`/gestion/acquereurs/${d.fileId}`}>{d.file.acquirer.registeredName} →</Link>):<span className="muted">Aucun rattachement validé</span>}</div></article>)}{!parcels.length&&<p className="empty-text">Aucune parcelle trouvée.</p>}</div><div className="actions">{page>1&&<Link className="button secondary compact" href={`/gestion/parcelles?${new URLSearchParams({q,page:String(page-1)})}`}>Précédent</Link>}{page*20<count&&<Link className="button secondary compact" href={`/gestion/parcelles?${new URLSearchParams({q,page:String(page+1)})}`}>Suivant</Link>}</div></section></Shell>;
}
