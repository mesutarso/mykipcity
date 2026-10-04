import {MemberDossierSelector} from "@/components/member-dossier-selector";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { ownFile } from "@/lib/workflow";
import { db } from "@/lib/db";
import { Shell,Heading } from "@/components/shell";
import { ProfileForm } from "@/components/profile-form";
export default async function Profile(){
 const actor=await pageActor();if(actor.role!=="ACQUIRER")redirect(homeForRole(actor.role));const file=await ownFile(actor.id);
 const history=await db.auditEvent.findMany({where:{objectId:file.id,action:"PROFILE_UPDATED"},orderBy:{createdAt:"desc"},take:10});
 return <Shell name={actor.name}><MemberDossierSelector userId={actor.id} fileId={file.id}/><Heading eyebrow="MYKIPCITY" title="Mon profil"/><div className="content-grid"><section className="panel"><h2>Mes coordonnées</h2><ProfileForm key={file.id} initial={{fileId:file.id,phone:file.phone,city:file.city,country:file.country,version:file.version}}/></section><div className="stack"><section className="panel"><h2>Mon compte</h2><dl><dt>Nom au registre</dt><dd>{file.acquirer.registeredName}</dd><dt>Référence acquéreur</dt><dd>{file.acquirer.reference}</dd><dt>Adresse de connexion</dt><dd>{actor.email}</dd></dl><p className="profile-help">Pour corriger votre identité ou votre adresse de connexion, contactez l’équipe.</p><Link href="/mykipcity/contact" className="text-link">Contacter l’équipe →</Link></section><section className="panel"><h2>Dernières mises à jour</h2>{history.length?<ol className="timeline">{history.map(event=>{const detail=JSON.parse(event.detail);const labels:Record<string,string>={phone:"Téléphone",city:"Ville",country:"Pays"};return <li key={event.id}><div>{Object.entries(labels).filter(([key])=>detail.before[key]!==detail.after[key]).map(([key,label])=><p key={key}>{label} : {detail.after[key]}</p>)}</div><time dateTime={event.createdAt.toISOString()}>{event.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa",dateStyle:"short",timeStyle:"short"})}</time></li>;})}</ol>:<p className="empty-text">Aucune modification de coordonnées enregistrée ici.</p>}</section></div></div></Shell>;
}
