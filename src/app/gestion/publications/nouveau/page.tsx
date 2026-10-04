import { redirect } from "next/navigation";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { Shell,Heading } from "@/components/shell";
import { PublicationForm } from "@/components/publication-form";
export default async function NewPublication(){const actor=await pageActor();if(actor.role!=="ACQUIRER_AGENT")redirect(homeForRole(actor.role));return <Shell staff name={actor.name}><Heading eyebrow="MYKIPCITY" title="Nouvelle publication"/><section className="panel"><PublicationForm/></section></Shell>;}
