import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { Shell,Heading } from "@/components/shell";
import { InstitutionForm } from "@/components/institution-forms";
import { redirect } from "next/navigation";
export default async function NewInstitution(){const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));return <Shell name={actor.name} finance><Heading eyebrow="FINANCE" title="Ajouter une institution"/><section className="panel finance-form"><InstitutionForm/></section></Shell>;}
