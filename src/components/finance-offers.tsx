import Link from "next/link";
import { db } from "@/lib/db";
import { financeCase } from "@/lib/finance";
import { offerSchema,offerValidity,rateMethods } from "@/lib/institution-model";
import { minorUnits,money } from "@/lib/finance-model";
import { OfferForm } from "./institution-forms";
export async function FinanceOffers({caseId,userId}:{caseId:string;userId:string}){
 const item=await financeCase(userId,caseId);
 const [offers,institutions,docs]=await Promise.all([db.financeOffer.findMany({where:{caseId},include:{institution:{select:{name:true}}},orderBy:{createdAt:"desc"}}),db.financeInstitution.findMany({where:{ownerId:userId},select:{id:true,name:true,branch:true},orderBy:{name:"asc"}}),db.financeDocument.findMany({where:{requirement:{caseId},status:"ACCEPTED"},include:{requirement:true}})]);
 const documents=docs.filter(d=>d.revision===d.requirement.version).map(d=>({id:d.id,name:`${d.originalName} · v${d.revision}`}));
 return <><section className="panel"><h2>Offres du dossier</h2>{offers.length?<div className="offer-comparison">{offers.map(offer=>{const v=offerSchema.parse(offer.data);const snap=offer.institutionSnapshot as {name:string};return <article className="offer-card" key={offer.id}><h3>{snap.name}</h3><p>{v.product}</p><dl><dt>Montant proposé</dt><dd>{v.amount?money(minorUnits(v.amount),v.currency):"Non renseigné"}</dd><dt>Durée</dt><dd>{v.durationMonths?`${v.durationMonths} mois`:"Non renseignée"}</dd><dt>Méthode de taux</dt><dd>{rateMethods[v.rateMethod]}</dd><dt>Validité</dt><dd>{offerValidity(v)}{v.validUntil?` · ${v.validUntil.split("-").reverse().join("/")}`:""}</dd><dt>Référence écrite</dt><dd>{v.writtenReference||"Non renseignée"}</dd><dt>Justificatif</dt><dd>{!v.documentId?"Non joint":documents.some(d=>d.id===v.documentId)?"Pièce contrôlée jointe":"Pièce remplacée ou à revoir"}</dd></dl><Link className="text-link" href={`/finance/${caseId}/offres/${offer.id}`}>Consulter l’offre →</Link></article>;})}</div>:<p className="empty-text">Aucune offre enregistrée.</p>}</section>{item.status==="DRAFT"&&<section className="panel finance-form"><h2>Enregistrer une offre reçue</h2>{institutions.length?<OfferForm caseId={caseId} institutions={institutions} documents={documents}/>:<Link href="/finance/institutions/nouveau" className="button">Ajouter d’abord une institution</Link>}</section>}</>;
}
