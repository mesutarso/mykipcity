import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { pageActor } from "@/lib/session";
import { homeForRole, staffRoles } from "@/lib/roles";
import { Shell, Heading } from "@/components/shell";
import { TeamForm } from "@/components/team-forms";
export default async function Member({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(); if (actor.role !== "ADMIN") redirect(homeForRole(actor.role));
  const member = await db.user.findUnique({ where: { id: (await params).id } });
  if (!member || !(member.role in staffRoles)) notFound();
  const events = await db.auditEvent.findMany({ where: { objectId: member.id, action: "STAFF_ACCESS_CHANGED" }, orderBy: { createdAt: "desc" }, take: 30 });
  const authors = await db.user.findMany({ where: { id: { in: events.map(e => e.actorId) } }, select: { id: true, name: true } });
  return <Shell name={actor.name} admin><Link href="/administration/equipe">← Équipe</Link><Heading eyebrow="COLLABORATEUR" title={member.name}/><section className="panel narrow"><p>{member.email}</p>{member.id === actor.id ? <p>Votre accès doit être modifié par un autre administrateur.</p> : <TeamForm member={{ id: member.id, role: member.role, active: member.active, accessVersion: member.accessVersion }}/>}</section><section className="panel"><h2>Historique des accès</h2>{events.map(event => { const detail = JSON.parse(event.detail); return <article className="review-card" key={event.id}><p>{event.createdAt.toLocaleString("fr-FR", { timeZone: "Africa/Kinshasa" })} · {authors.find(a => a.id === event.actorId)?.name ?? "Administrateur"}</p><p>{staffRoles[detail.before.role as keyof typeof staffRoles]} ({detail.before.active ? "actif" : "suspendu"}) → {staffRoles[detail.after.role as keyof typeof staffRoles]} ({detail.after.active ? "actif" : "suspendu"})</p><p>{detail.reason}</p></article>; })}{!events.length && <p>Aucun changement d’accès.</p>}</section></Shell>;
}
