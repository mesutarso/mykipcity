import {MemberDossierSelector} from "@/components/member-dossier-selector";
import {Pagination} from "@/components/pagination";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { ownFile } from "@/lib/workflow";
import { memberDocumentList } from "@/lib/member-documents";
import { documentCategories } from "@/lib/member-document-model";
import { Shell,Heading } from "@/components/shell";
import { MemberDocumentList } from "@/components/member-document-list";
export default async function Documents({searchParams}:{searchParams:Promise<{dossier?:string;parcelle?:string;type?:string;vue?:string;page?:string}>}){
 const actor=await pageActor();if(actor.role!=="ACQUIRER")redirect(homeForRole(actor.role));const file=await ownFile(actor.id,(await searchParams).dossier);const {items}=await memberDocumentList(actor.id,file.id);const p=await searchParams;
 const refs=[...new Set([...file.declarations.map(d=>d.reference),...items.flatMap(i=>i.parcelReferences as string[])])];
 const filtered=items.filter(i=>(!p.type||i.category===p.type)&&(!p.parcelle||(i.parcelReferences as string[]).includes(p.parcelle)||!(i.parcelReferences as string[]).length)&&(!p.vue||(p.vue==="received"?i.direction==="RECEIVED":p.vue==="pending"?i.direction==="REQUESTED"&&!i.closedAt&&(!i.versions[0]||i.versions[0].status==="NEEDS_INFO"):i.direction==="REQUESTED")));
 const page=Math.max(1,Math.min(Math.max(1,Math.ceil(filtered.length/20)),Number.parseInt(p.page??"1")||1));
 const legacy=(!p.type||p.type==="CONTRACT")&&(!p.vue||p.vue==="sent");
 return <Shell name={actor.name}><MemberDossierSelector userId={actor.id} fileId={file.id}/><Heading eyebrow="MYKIPCITY" title="Mes documents"><Link href={`/mon-dossier?dossier=${file.id}`} className="text-link">Mon dossier et mes contrats →</Link></Heading><section className="panel"><form key={`${p.parcelle??""}-${p.type??""}-${p.vue??""}`} className="filters"><input type="hidden" name="dossier" value={file.id}/><label>Afficher<select name="vue" defaultValue={p.vue??""}><option value="">Tous les documents</option><option value="pending">À fournir ou corriger</option><option value="sent">Mes pièces demandées</option><option value="received">Reçus de l’équipe</option></select></label><label>Parcelle<select name="parcelle" defaultValue={p.parcelle??""}><option value="">Toutes mes parcelles</option>{refs.map(ref=><option key={ref}>{ref}</option>)}</select></label><label>Type<select name="type" defaultValue={p.type??""}><option value="">Tous les types</option>{Object.entries(documentCategories).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><button className="button">Filtrer</button><Link href={`/mykipcity/documents?dossier=${file.id}`} className="text-link">Effacer</Link></form><p className="small muted">Les pièces du dossier général restent visibles pour toutes vos parcelles.</p></section><div className="document-workspace"><MemberDocumentList items={filtered.slice((page-1)*20,page*20)}/><Pagination page={page} total={filtered.length} params={{dossier:file.id,parcelle:p.parcelle??"",type:p.type??"",vue:p.vue??""}}/>{legacy&&file.documents.length>0&&<section className="panel"><h2>Contrats du dossier initial</h2>{file.documents.map(d=><a className="document-row" href={`/api/documents/${d.id}`} key={d.id}><span><strong>{d.originalName}</strong><small>Dossier général · {Math.ceil(d.size/1024)} Ko · Examen manuel</small></span>Télécharger</a>)}</section>}{!filtered.length&&(!legacy||!file.documents.length)&&<section className="panel"><p>Aucun document dans cette sélection.</p></section>}</div></Shell>;
}
