import { db } from "@/lib/db";
import { ReopeningForm } from "./reopening-form";
export async function ReopeningPanel({item,validator=false}:{item:{id:string;version:number;status:string};validator?:boolean}){
 if(item.status!=="INTERNALLY_VALIDATED")return null;
 const current=await db.financeCase.findUniqueOrThrow({where:{id:item.id},select:{reopeningRequestId:true,validatorId:true}});
 const assignedValidator=current.validatorId?await db.user.findUnique({where:{id:current.validatorId},select:{name:true,active:true}}):null;
 const pending=current.reopeningRequestId?await db.financeReviewEvent.findUnique({where:{id:current.reopeningRequestId}}):null;
 if(validator&&!pending)return null;
 return <section className="panel"><h2>Correction après validation</h2>{pending?<><p className="status">Réouverture en attente</p><p>{pending.reason}</p><p className="muted small">{pending.actorName} · {pending.createdAt.toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa"})}</p></>:<p>La demande sera examinée par {assignedValidator?.name??"le validateur du dossier"}.</p>}{assignedValidator&&!assignedValidator.active&&<p className="feedback">Le validateur est indisponible. L’administration peut désigner un remplaçant dans Affectations Finance → Validateurs.</p>}<p className="muted small">La réouverture conserve l’historique, retire les autorisations préparées et impose un nouveau contrôle avant validation.</p><ReopeningForm key={item.version} id={item.id} version={item.version} mode={validator?"decide":pending?"cancel":"request"}/></section>;
}
