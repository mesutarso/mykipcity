import {MemberDossierSelector} from "@/components/member-dossier-selector";
import Link from "next/link";
import { memberDashboardPublications } from "@/lib/publications";
import { PublicationCard } from "@/components/publication-card";
import { homeForRole } from "@/lib/roles";
import { pageActor } from "@/lib/session";
import { ownFile, WorkflowError } from "@/lib/workflow";
import { db } from "@/lib/db";
import { Shell, Heading, Status } from "@/components/shell";
import { redirect,notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

const descriptions:Record<string,string>={ACCOUNT_CONSOLIDATED:"Dossiers regroupés sous votre compte",PARCEL_ACCESS_TRANSFERRED:"Titulaire de l’accès remplacé",PROFILE_UPDATED:"Coordonnées mises à jour",DOSSIER_SAVED:"Dossier enregistré",DOCUMENT_DEPOSITED:"Document déposé",DOSSIER_SUBMITTED:"Dossier transmis",PARCEL_APPROVED:"Rattachement validé",PARCEL_REJECTED:"Rattachement refusé",PARCEL_NEEDS_INFO:"Complément demandé",MESSAGE_SENT:"Message envoyé",DOCUMENT_DOWNLOADED:"Document consulté"};
const dossierCopy:Record<string,{title:string;description:string;action:string}>={
  DRAFT:{title:"Complétez votre dossier",description:"Renseignez vos informations et ajoutez les contrats de vos parcelles.",action:"Compléter mon dossier"},
  NEEDS_INFO:{title:"Votre dossier est à compléter",description:"Consultez les précisions demandées par l’équipe pour poursuivre la vérification.",action:"Compléter mon dossier"},
  SUBMITTED:{title:"Votre dossier est en cours d’examen",description:"L’équipe vérifie vos informations et les documents transmis.",action:"Consulter mon dossier"},
  VERIFIED:{title:"Votre dossier est vérifié",description:"Retrouvez vos parcelles et les informations partagées par l’équipe.",action:"Consulter mon dossier"},
  CLOSED:{title:"Votre dossier est clôturé",description:"Consultez les décisions de l’équipe. Vous pouvez la contacter pour demander un réexamen.",action:"Consulter les décisions"},
};
export default async function Dashboard({searchParams}:{searchParams:Promise<{parcelle?:string}>}){
  const actor=await pageActor();
  if(actor.role!=="ACQUIRER")redirect(homeForRole(actor.role));
  const file=await ownFile(actor.id);
  const selected=(await searchParams).parcelle||undefined;
  const publications=await memberDashboardPublications(actor.id,selected).catch(e=>{if(e instanceof WorkflowError&&e.status===404)notFound();throw e;});
  const approved=file.declarations.filter(p=>p.status==="APPROVED");
  const requestedDocuments=await db.memberDocument.findMany({where:{fileId:file.id,direction:"REQUESTED",closedAt:null},select:{versions:{orderBy:{revision:"desc"},take:1,select:{status:true}}}});
  const outstandingDocuments=requestedDocuments.filter(item=>!item.versions[0]||item.versions[0].status==="NEEDS_INFO").length;
  const events=await db.auditEvent.findMany({where:{objectId:file.id,action:{in:Object.keys(descriptions)}},orderBy:{createdAt:"desc"},take:5});
  const copy=dossierCopy[file.status]??{title:"Mon dossier",description:"Consultez l’état de votre dossier et les décisions de l’équipe.",action:"Consulter mon dossier"};
  return <Shell name={actor.name}><MemberDossierSelector userId={actor.id} fileId={file.id}/>
    <div className="member-home">
      <Heading eyebrow="MON ESPACE KIP-CITY" title={`Bonjour, ${actor.name.split(" ")[0]}.`} description="Votre dossier, vos parcelles et les nouvelles de Kip-City."/>
      <section className="dossier-summary" aria-labelledby="dossier-title">
        <div><p className="eyebrow">MON DOSSIER · {file.acquirer.reference}</p><h2 id="dossier-title">{copy.title}</h2><p className="muted">{copy.description}</p></div>
        <Link href="/mon-dossier" className="button">{copy.action}<ArrowUpRight size={16} aria-hidden/></Link>
      </section>
      {outstandingDocuments>0&&<div className="document-reminder"><span>{outstandingDocuments} document{outstandingDocuments>1?"s":""} à fournir ou corriger</span><Link className="text-link" href="/mykipcity/documents?vue=pending">Voir les pièces demandées ↗</Link></div>}
      <div className="member-columns">
        <div className="member-main">
          <section aria-labelledby="parcels-title">
            <div className="section-title"><h2 id="parcels-title">Mes parcelles</h2><Link className="text-link" href="/mon-dossier">Mon dossier ↗</Link></div>
            <div className="member-parcels">{file.declarations.length?file.declarations.map(p=><article key={p.id} className="member-parcel">
              <div><h3>{p.status==="APPROVED"&&p.parcel?p.parcel.reference:p.reference}</h3><p className="muted small">{p.status==="APPROVED"&&p.parcel?`${p.parcel.area} m² · ${p.parcel.cadastralReference}`:"Rattachement à vérifier"}</p>{p.reason&&<p className="small parcel-reason">{p.reason}</p>}</div>
              <div className="parcel-actions"><Status value={p.status}/>{p.accessExpiresAt&&<small>Jusqu’au {new Date(p.accessExpiresAt.getTime()-1).toLocaleDateString("fr-FR",{timeZone:"Africa/Kinshasa"})}</small>}{p.status==="APPROVED"&&p.parcelId?<Link href={`/mykipcity?parcelle=${p.parcelId}#mes-informations`} className="text-link">Consulter ↗</Link>:<Link href="/mon-dossier" className="text-link">Voir mon dossier ↗</Link>}</div>
            </article>):<p className="empty-text">Ajoutez votre première parcelle dans votre dossier.</p>}</div>
          </section>
          {approved.length>0&&<section id="mes-informations" aria-labelledby="information-title">
            <div className="section-title"><h2 id="information-title">Mes informations</h2></div>
            <form key={selected??"all"} className="filters home-parcel-filter" action="/mykipcity#mes-informations"><label>Parcelle<select name="parcelle" defaultValue={selected??""}><option value="">Toutes mes parcelles</option>{publications.parcels.map(p=><option key={p.id} value={p.id}>{p.reference}</option>)}</select></label><button className="button secondary compact">Afficher</button></form>
            <div className="panel personal-publications">{publications.personal.length?publications.personal.map(item=><PublicationCard key={item.id} item={item}/>):<p className="empty-text">Aucune nouvelle information pour le moment.</p>}
              <div className="home-shortcuts"><Link className="text-link" href={`/mykipcity/documents${selected?`?parcelle=${encodeURIComponent(publications.parcels.find(p=>p.id===selected)?.reference??"")}`:""}`}>Mes documents ↗</Link><Link className="text-link" href="/mykipcity/finance">Mon accompagnement financier ↗</Link></div>
            </div>
          </section>}
        </div>
        {approved.length>0&&<section className="member-news" aria-labelledby="news-title"><div className="section-title"><h2 id="news-title">La vie de Kip-City</h2></div><div className="panel news-publications">{publications.general.length?publications.general.map(item=><PublicationCard key={item.id} item={item}/>):<p className="empty-text">Aucune actualité pour le moment.</p>}<Link className="text-link" href="/mykipcity/informations">Toutes mes informations ↗</Link></div></section>}
      </div>
      <section className="member-activity" aria-labelledby="activity-title"><div className="section-title"><h2 id="activity-title">Mes dernières démarches</h2><Link className="text-link" href="/mykipcity/contact">Contacter l’équipe ↗</Link></div>{events.length?<ol className="timeline">{events.map(e=><li key={e.id}><span>{descriptions[e.action]}</span><time dateTime={e.createdAt.toISOString()}>{e.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa",dateStyle:"short",timeStyle:"short"})}</time></li>)}</ol>:<p className="empty-text">Vos prochaines démarches apparaîtront ici.</p>}</section>
    </div>
  </Shell>;
}
