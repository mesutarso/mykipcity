import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { Shell,Heading } from "@/components/shell";
import { IncidentCreateForm } from "@/components/incident-forms";
export default async function NewIncident(){const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));const [cases,owners,people]=await Promise.all([db.financeCase.findMany({where:{ownerId:actor.id},select:{id:true,reference:true},orderBy:{updatedAt:"desc"}}),db.user.findMany({where:{active:true,role:"FINANCE_OFFICER"},select:{id:true,name:true},orderBy:{name:"asc"}}),db.user.findMany({where:{role:{not:"ACQUIRER"}},select:{id:true,name:true},orderBy:{name:"asc"}})]);return <Shell name={actor.name} finance><Link href="/finance/incidents">← Signalements</Link><Heading eyebrow="FIN-F08" title="Nouveau signalement"/><section className="panel"><IncidentCreateForm cases={cases} owners={owners} people={people} userId={actor.id}/></section></Shell>;}
