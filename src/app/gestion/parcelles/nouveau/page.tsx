import { homeForRole } from "@/lib/roles";
import Link from "next/link";
import { pageActor } from "@/lib/session";
import { redirect } from "next/navigation";
import { Shell,Heading } from "@/components/shell";
import { RegistryForm } from "@/components/forms";
export default async function NewParcel(){const actor=await pageActor();if(actor.role!=="ACQUIRER_AGENT")redirect(homeForRole(actor.role));return <Shell name={actor.name} staff><Heading title="Ajouter une parcelle" eyebrow="PARCELLES"/><section className="panel narrow"><RegistryForm kind="parcel"/><Link href="/gestion/parcelles" className="text-link">Annuler</Link></section></Shell>;}
