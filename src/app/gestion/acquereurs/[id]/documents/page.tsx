import {Pagination} from "@/components/pagination";
import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { WorkflowError } from "@/lib/workflow";
import { memberDocumentList } from "@/lib/member-documents";
import { Shell,Heading } from "@/components/shell";
import { MemberDocumentList } from "@/components/member-document-list";
import { MemberDocumentCreate } from "@/components/member-document-forms";
export default async function Documents({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{page?:string}>}){const actor=await pageActor();if(actor.role!=="ACQUIRER_AGENT")redirect(homeForRole(actor.role));const {id}=await params;const {file,items}=await memberDocumentList(actor.id,id).catch(e=>{if(e instanceof WorkflowError&&e.status===404)notFound();throw e;});const page=Math.max(1,Math.min(Math.max(1,Math.ceil(items.length/20)),Number.parseInt((await searchParams).page??"1")||1));return <Shell staff name={actor.name}><Heading eyebrow={file.acquirer.reference} title={`Documents — ${file.fullName||file.acquirer.registeredName}`}><Link className="text-link" href={`/gestion/acquereurs/${id}`}>Retour au dossier →</Link></Heading><div className="content-grid"><div><MemberDocumentList items={items.slice((page-1)*20,page*20)} staff/><Pagination page={page} total={items.length}/>{!items.length&&<section className="panel"><p>Aucune demande ni remise de document.</p></section>}</div><section className="panel"><h2>Demander ou remettre une pièce</h2><MemberDocumentCreate fileId={id} parcels={file.declarations.map(d=>d.reference)}/></section></div></Shell>;}
