import Link from "next/link";
import { db } from "@/lib/db";
import { financeCase } from "@/lib/finance";
import { authorizationStates,authorizationPeriod,type AuthorizationPayload } from "@/lib/authorization-model";
import { AuthorizationForm } from "./authorization-form";
export async function Authorizations({caseId,userId}:{caseId:string;userId:string}){
 const item=await financeCase(userId,caseId);
 const records=await db.financeAuthorization.findMany({where:{caseId},orderBy:{createdAt:"desc"}});
 const institutions=await db.financeInstitution.findMany({where:{ownerId:userId},select:{id:true,name:true,branch:true},orderBy:{name:"asc"}});
 const review=item.status==="INTERNALLY_VALIDATED"?await db.financeReview.findUnique({where:{caseId_cycle:{caseId,cycle:item.reviewCycle}}}):null;
 const documents=(review?.snapshot as unknown as {documents:AuthorizationPayload["documents"]}|undefined)?.documents??[];
 return <><section className="panel"><h2>Autorisations de transmission</h2><p className="muted">Une autorisation par institution, pour les seules informations et pièces listées.</p>{records.map(a=>{const p=a.payload as unknown as AuthorizationPayload;return <article className="review-card" key={a.id}><h3>{p.institution.name}</h3><p>{p.input.purpose}</p><p>{authorizationStates[a.status]} · {authorizationPeriod(p.input)}</p><Link className="text-link" href={`/finance/${caseId}/autorisations/${a.id}`}>Consulter l’autorisation →</Link></article>;})}{!records.length&&<p>Aucune autorisation préparée.</p>}</section><section className="panel"><h2>Préparer une autorisation</h2>{item.reopeningRequestId?<p>La préparation est suspendue pendant la demande de réouverture.</p>:!review?<p>La validation interne du dossier doit être terminée.</p>:!institutions.length?<Link className="button" href="/finance/institutions/nouveau">Ajouter l’institution destinataire</Link>:<AuthorizationForm caseId={caseId} cycle={item.reviewCycle} institutions={institutions} documents={documents}/>}</section></>;
}
