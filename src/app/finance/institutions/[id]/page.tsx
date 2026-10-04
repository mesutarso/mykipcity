import Link from "next/link";
import { pageActor } from "@/lib/session";
import { homeForRole } from "@/lib/roles";
import { db } from "@/lib/db";
import { Shell,Heading } from "@/components/shell";
import { InstitutionForm } from "@/components/institution-forms";
import { institutionSchema } from "@/lib/institution-model";
import { redirect,notFound } from "next/navigation";
export default async function Institution({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string}>}){
 const actor=await pageActor();if(actor.role!=="FINANCE_OFFICER")redirect(homeForRole(actor.role));const item=await db.financeInstitution.findFirst({where:{id:(await params).id,ownerId:actor.id}});if(!item)notFound();const {name,branch,contactName,contactRole,email,phone,address,notes}=item;
 return <Shell name={actor.name} finance><Link href="/finance/institutions" className="text-link">← Institutions</Link><Heading eyebrow="FICHE INSTITUTION" title={item.name}/>{(await searchParams).saved==="1"&&<p role="status" className="feedback success">Fiche enregistrée.</p>}<section className="panel finance-form"><InstitutionForm key={item.version} id={item.id} version={item.version} initial={institutionSchema.parse({name,branch,contactName,contactRole,email,phone,address,notes})}/></section></Shell>;
}
