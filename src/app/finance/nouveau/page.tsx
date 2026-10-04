import Link from "next/link";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { Shell,Heading } from "@/components/shell";
import { RequestForm } from "@/components/finance-forms";
import { redirect } from "next/navigation";
export default async function NewRequest(){const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));return <Shell name={actor.name} finance><Heading eyebrow="FIN-F01" title="Nouvelle demande"/><section className="panel finance-form"><RequestForm/><Link href="/finance" className="text-link">Annuler</Link></section></Shell>;}
