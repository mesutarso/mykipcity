import Link from "next/link";
import {notFound} from "next/navigation";
import {db} from "@/lib/db";
import {pageActor} from "@/lib/session";
import {Shell,Heading} from "@/components/shell";
import {OriginalForm} from "@/components/original-forms";
export default async function NewOriginal({searchParams}:{searchParams:Promise<{dossier?:string}>}){
 const actor=await pageActor(),{dossier}=await searchParams;if(actor.role!=="LEGAL_OFFICER"||!dossier)notFound();
 const item=await db.financeCase.findFirst({where:{id:dossier,legalOfficerId:actor.id},select:{id:true,reference:true,applicantName:true}});if(!item)notFound();
 const reviewers=await db.user.findMany({where:{active:true,role:"LEGAL_OFFICER",personId:{not:actor.personId}},select:{id:true,name:true},orderBy:{name:"asc"}});
 return <Shell name={actor.name} legal><Link href={`/juridique/${item.id}`} className="text-link">← Dossier {item.reference}</Link><Heading eyebrow={item.applicantName} title="Enregistrer un original"/><section className="panel"><OriginalForm caseId={item.id} reviewers={reviewers} kinds={["DEPOSIT"]}/></section></Shell>;
}
