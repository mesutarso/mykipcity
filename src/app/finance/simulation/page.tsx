import {redirect} from "next/navigation";
import {pageActor} from "@/lib/session";
import {homeForRole} from "@/lib/roles";
import {Shell,Heading} from "@/components/shell";
import {FinanceSimulator} from "@/components/finance-simulator";
export default async function Page(){const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));return <Shell finance name={actor.name}><Heading eyebrow="FINANCE" title="Simulation indicative"/><FinanceSimulator/></Shell>;}
