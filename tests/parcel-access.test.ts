import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {accessStatus} from "../src/lib/parcel-access-model";
test("Droits MyKipCity : cotitulaires, mandats, expiration et retrait",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-rights-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DOCUMENTS_DIR=`${root}/files`;process.env.DEMO_MODE="true";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db"),flow=await import("../src/lib/workflow"),docs=await import("../src/lib/documents"),{manageParcelAccess}=await import("../src/lib/parcel-access"),pubs=await import("../src/lib/publications"),model=await import("../src/lib/dossier-model");
 try{
  for(const [id,role] of [["agent","ACQUIRER_AGENT"],["admin","ADMIN"],["holder","ACQUIRER"],["co","ACQUIRER"],["rep","ACQUIRER"],["stranger","ACQUIRER"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id}});
  const parcel=await db.parcel.create({data:{reference:"P1",cadastralReference:"PC1",area:700}});
  const proofIds:Record<string,string>={};
  for(const [id,quality] of [["holder","HOLDER"],["co","COHOLDER"],["rep","REPRESENTATIVE"],["stranger","HOLDER"]] as const){
   await db.acquirer.create({data:{id,reference:id,registeredName:id,email:`${id}@test.invalid`,personId:id,userId:id,file:{create:{id:`file-${id}`,fullName:id,phone:"12345",city:"Kinshasa",country:"RDC",details:model.identityDetails.parse({quality,lastName:id,holderName:"Titulaire",address:"Rue"}),declarations:{create:{id:`parcel-${id}`,reference:"P1",contractNumber:"C1",details:model.parcelDetails.parse({quality,holders:"Titulaire"})}}}}}});
   const proof=await docs.depositDocument(id,"contrat.pdf",Buffer.from("%PDF-1.4 CONTRAT"),model.documentDetails.parse({category:"LEASE",parcelReferences:["P1"],reference:"C1",issuedOn:"",issuer:"",effectiveOn:"",duration:"",observation:""}));proofIds[id]=proof.id;
   if(id==="rep"){const mandate=await docs.depositDocument(id,"mandat.pdf",Buffer.from("%PDF-1.4 MANDAT"),model.documentDetails.parse({category:"MANDATE",parcelReferences:["P1"],reference:"M1",issuedOn:"",issuer:"",effectiveOn:"",duration:"",observation:""}));proofIds[id]=mandate.id;}
   const file=await flow.ownFile(id);await flow.submitDossier(id,file.version);
  }
  const access=(id:string)=>({quality:id==="co"?"COHOLDER" as const:"REPRESENTATIVE" as const,proofId:proofIds[id],principal:id==="rep"?"Titulaire":"",expiresOn:id==="rep"?"2099-12-31":"",checked:true as const,sharedChecked:true});
  const review=async(id:string,permission?:unknown)=>flow.reviewDeclaration("agent",{declarationId:`parcel-${id}`,version:(await flow.ownFile(id)).version,decision:"APPROVED",reason:"Identité et droits examinés sur les pièces",checkedDocuments:true,...(permission?{access:permission}:{})});
  const publication=await db.memberPublication.create({data:{title:"Information parcelle",body:"Suivi du terrain",audience:"PARCEL",targetId:parcel.id,status:"PUBLISHED",publishedAt:new Date(),authorId:"agent",authorPersonId:"agent"}});
  const privatePublication=await db.memberPublication.create({data:{title:"Personnel titulaire",body:"Personnel",audience:"ACQUIRER",targetId:"holder",status:"PUBLISHED",publishedAt:new Date(),authorId:"agent",authorPersonId:"agent"}});
  await t.test("Une déclaration seule n’ouvre aucun droit, cotitularité vérifiée explicitement",async()=>{
   await assert.rejects(pubs.memberPublication("co",publication.id),{status:404});await review("holder");
   await assert.rejects(review("co"),/examen de l’équipe/);
   await assert.rejects(review("co",{...access("co"),proofId:proofIds.holder}),/pièce actuelle/);
   await assert.rejects(review("co",{...access("co"),sharedChecked:false}),{status:409});
   await review("co",access("co"));assert.equal((await pubs.memberPublication("co",publication.id)).id,publication.id);
   await assert.rejects(pubs.memberPublication("co",privatePublication.id),{status:404});await assert.rejects(docs.readDocument("co",proofIds.holder),{status:404});
   await assert.rejects(review("stranger"),/examen de l’équipe/);
  });
  await t.test("Mandat : titulaire, date et qualité contrôlés avant validation",async()=>{
   await assert.rejects(review("rep",{...access("rep"),expiresOn:""}),/date de fin/);
   await assert.rejects(review("rep",{...access("rep"),principal:""}),/titulaire représenté/);
   await assert.rejects(review("rep",{...access("rep"),expiresOn:"2000-01-01"}),/dépassée/);
   await assert.rejects(review("rep",{...access("rep"),quality:"HOLDER"}),/qualité/);
   const contract=await db.document.findFirstOrThrow({where:{fileId:"file-rep",originalName:"contrat.pdf"}});await assert.rejects(review("rep",{...access("rep"),proofId:contract.id}),/mandat de représentation/);
   await review("rep",access("rep"));assert.equal((await pubs.memberPublication("rep",publication.id)).id,publication.id);
   const stored=await db.parcelDeclaration.findUniqueOrThrow({where:{id:"parcel-rep"}});assert.ok(stored.accessVerification);assert.equal(accessStatus(stored,new Date("2100-01-01")),"ACCESS_EXPIRED");
  });
  await t.test("Expiration immédiate côté serveur, sans retirer les archives personnelles",async()=>{
   await db.parcelDeclaration.update({where:{id:"parcel-rep"},data:{accessExpiresAt:new Date("2000-01-01")}});
   const file=await flow.ownFile("rep");assert.equal(file.declarations[0].status,"ACCESS_EXPIRED");assert.equal(file.declarations[0].parcel,null);
   await assert.rejects(pubs.memberPublication("rep",publication.id),{status:404});assert.equal((await pubs.memberPublications("rep")).count,0);await docs.readDocument("rep",proofIds.rep);
   const {memberFinance}=await import("../src/lib/member-finance");assert.deepEqual(await memberFinance("rep"),[]);
  });
  await t.test("Renouvellement avec une nouvelle pièce demandée : version contrôlée et bon dossier",async()=>{
   const md=await import("../src/lib/member-documents");
   const requirement=await md.createMemberDocument("agent",{fileId:"file-rep",title:"Nouveau mandat",category:"MANDATE",parcelReferences:["P1"],direction:"REQUESTED",instructions:"Copie du mandat renouvelé"});
   const command={id:"parcel-rep",version:(await flow.ownFile("rep")).version,action:"RENEW",reason:"Mandat renouvelé examiné par l’équipe",access:access("rep")};
   const uploaded=await md.uploadMemberDocument("rep",{documentId:requirement.id,version:0},"mandat-neuf.pdf",Buffer.from("%PDF-1.4 NOUVEAU MANDAT"));
   await assert.rejects(manageParcelAccess("agent",{...command,access:{...command.access,proofId:`member:${uploaded.id}`}}),/contrôlée/);
   await md.reviewMemberDocument("agent",{documentId:requirement.id,version:1,decision:"ACCEPTED",reason:"Mandat et périmètre vérifiés"});
   await manageParcelAccess("agent",{...command,access:{...command.access,proofId:`member:${uploaded.id}`}});await pubs.memberPublication("rep",publication.id);
  });
  await t.test("Retrait ciblé, concurrence et renouvellement motivé",async()=>{
   const file=await flow.ownFile("co");const command={id:"parcel-co",version:file.version,action:"REVOKE",reason:"Retrait demandé après examen du périmètre"};
   for(const actor of ["co","admin"])await assert.rejects(manageParcelAccess(actor,command),{status:403});
   const races=await Promise.allSettled([manageParcelAccess("agent",command),manageParcelAccess("agent",command)]);assert.equal(races.filter(r=>r.status==="fulfilled").length,1);
   await assert.rejects(pubs.memberPublication("co",publication.id),{status:404});await pubs.memberPublication("holder",publication.id);
   assert.equal((await flow.ownFile("co")).declarations[0].status,"ACCESS_REVOKED");
   const version=(await flow.ownFile("co")).version;await manageParcelAccess("agent",{id:"parcel-co",version,action:"RENEW",reason:"Nouveaux droits examinés et confirmés",access:access("co")});await pubs.memberPublication("co",publication.id);
   assert.equal(await db.auditEvent.count({where:{objectId:"file-co",action:"PARCEL_ACCESS_REVOKE"}}),1);
   await db.user.update({where:{id:"agent"},data:{active:false}});await assert.rejects(manageParcelAccess("agent",{...command,version:version+1}),{status:403});
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
