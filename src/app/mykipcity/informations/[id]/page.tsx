import { publicationAttachments } from "@/lib/publication-attachments";
import { PublicationGallery } from "@/components/publication-gallery";
import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { memberPublication } from "@/lib/publications";
import { WorkflowError } from "@/lib/workflow";
import { Shell,Heading } from "@/components/shell";
export default async function Information({params}:{params:Promise<{id:string}>}){
 const actor=await pageActor();if(actor.role!=="ACQUIRER")redirect(homeForRole(actor.role));
 const item=await memberPublication(actor.id,(await params).id).catch(e=>{if(e instanceof WorkflowError&&e.status===404)notFound();throw e;});
 const files=await publicationAttachments(actor.id,item.id);
 return <Shell name={actor.name}><Heading eyebrow={item.audience==="MEMBERS"?"LA VIE DE KIP-CITY":"MES INFORMATIONS"} title={item.title}/><article className="panel">{item.audience==="PARCEL"&&<p className="eyebrow">Parcelle {item.targetReference}</p>}{item.publishedAt&&<p className="small muted">Publié le {item.publishedAt.toLocaleDateString("fr-FR",{timeZone:"Africa/Kinshasa",dateStyle:"long"})}</p>}<p className="publication-body">{item.body}</p>{files.length>0&&<h2>Photos et rapports</h2>}<PublicationGallery files={files}/></article><Link className="text-link" href="/mykipcity/informations">← Toutes mes informations</Link></Shell>;
}
