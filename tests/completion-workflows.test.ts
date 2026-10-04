import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {hashPassword,verifyPassword} from "better-auth/crypto";
test("Comptes, e-mails et affectations : parcours persistés",async t=>{
 const root=mkdtempSync(join(tmpdir(),"kip-completion-"));process.env.DATABASE_URL=`file:${root}/db`;process.env.DEMO_MODE="true";process.env.BETTER_AUTH_URL="http://127.0.0.1:3200";process.env.BETTER_AUTH_SECRET="test-only-secret-with-more-than-32-characters";process.env.MAIL_ENABLED="false";
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env,stdio:"pipe"});
 const {db}=await import("../src/lib/db"),mail=await import("../src/lib/mail"),contact=await import("../src/lib/management"),{notifications}=await import("../src/lib/notifications"),{replaceReviewer}=await import("../src/lib/assignments"),{controlledCase}=await import("../src/lib/finance-review");
 const password="Initial-password-123!";
 try{
  for(const [id,role] of [["buyer","ACQUIRER"],["agent","ACQUIRER_AGENT"],["second","ACQUIRER_AGENT"],["admin","ADMIN"],["owner","FINANCE_OFFICER"],["reviewer","FINANCE_REVIEWER"],["replacement","FINANCE_REVIEWER"],["validator","FINANCE_VALIDATOR"]])await db.user.create({data:{id,role,name:id,email:`${id}@test.invalid`,personId:id,emailVerified:true,accounts:{create:{id:`account-${id}`,accountId:id,providerId:"credential",password:await hashPassword(password)}}}});
  await db.acquirer.create({data:{id:"buyer",reference:"A1",registeredName:"Buyer",personId:"buyer",userId:"buyer",email:"buyer@test.invalid",file:{create:{id:"file"}}}});
  await t.test("Contact : routage, file partagée, suspension et concurrence",async()=>{
   const sent=await contact.sendMessage("buyer",{fileId:"file",body:"Bonjour, une question sur mon dossier."});
   assert.ok((await notifications("agent")).some(n=>n.id===`message:${sent.id}`));
   const input={fileId:"file",version:0,targetId:"second",reason:"Suivi confié à cette personne"};
   await assert.rejects(contact.assignConversation("buyer",input),{status:403});
   await assert.rejects(contact.assignConversation("agent",{...input,targetId:"owner"}),{status:409});
   await contact.assignConversation("agent",input);
   assert.ok(!(await notifications("agent")).some(n=>n.id===`message:${sent.id}`));assert.ok((await notifications("second")).some(n=>n.id===`message:${sent.id}`));
   await contact.conversation("agent","file");
   await assert.rejects(contact.assignConversation("agent",{...input,targetId:"agent"}),{status:409});
   await db.user.update({where:{id:"second"},data:{active:false}});
   assert.equal(await db.acquirerFile.count({where:await contact.contactQueue("agent","unassigned")}),1);
   assert.ok((await notifications("agent")).some(n=>n.id===`message:${sent.id}`));
  });
  await t.test("Remplacement du contrôleur indépendant sans modifier la copie soumise",async()=>{
   await db.financeCase.create({data:{id:"case",reference:"FIN-TEST",ownerId:"owner",reviewerId:"reviewer",validatorId:"validator",applicantName:"Buyer",pathway:"HABITAT",status:"IN_REVIEW",request:{},reviewCycle:1}});
   await db.financeReview.create({data:{caseId:"case",cycle:1,preparerPeople:["owner"],snapshot:{proof:"frozen"}}});
   const input={id:"case",version:1,targetId:"replacement",reason:"Contrôleur initial indisponible"};
   await assert.rejects(replaceReviewer("owner",input),{status:403});
   await db.user.update({where:{id:"replacement"},data:{personId:"owner"}});await assert.rejects(replaceReviewer("admin",input),{status:403});await db.user.update({where:{id:"replacement"},data:{personId:"replacement"}});
   const outcomes=await Promise.allSettled([replaceReviewer("admin",input),replaceReviewer("admin",input)]);assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);
   await assert.rejects(controlledCase("reviewer","case"),{status:404});assert.equal((await controlledCase("replacement","case")).id,"case");
   assert.deepEqual((await db.financeReview.findFirstOrThrow()).snapshot,{proof:"frozen"});assert.equal(await db.financeReviewEvent.count({where:{action:"REPLACE_REVIEWER"}}),1);
  });
  await t.test("Courriels : chiffrement, concurrence, reprises et expiration",async()=>{
   const input={key:"test-send",recipient:"buyer@test.invalid",userId:"buyer",kind:"NOTICE",subject:"Kip-City",text:"private-content",expiresAt:new Date(Date.now()+86400000)};
   await mail.queueMail(input);await mail.queueMail(input);assert.equal(await db.emailDelivery.count(),1);assert.ok(!(await db.emailDelivery.findFirstOrThrow()).payload.includes("private-content"));
   assert.equal((await mail.deliverMail()).enabled,false);
   process.env.MAIL_ENABLED="true";delete process.env.RESEND_API_KEY;delete process.env.MAIL_FROM;assert.equal(mail.mailReadiness().ready,false);assert.equal((await mail.deliverMail()).processed,0);assert.equal((await db.emailDelivery.findFirstOrThrow()).attempts,0);process.env.MAIL_ENABLED="false";
   let count=0;const transport=async(payload:{text:string})=>{assert.equal(payload.text,"private-content");count++;return "provider-id";};
   await Promise.all([mail.deliverMail(transport),mail.deliverMail(transport)]);assert.equal(count,1);assert.equal((await db.emailDelivery.findFirstOrThrow()).status,"SENT");
   await mail.queueMail({...input,key:"expire",expiresAt:new Date(Date.now()-1)});await mail.deliverMail(async()=>{throw new Error("must not send");});assert.equal((await db.emailDelivery.findUniqueOrThrow({where:{key:"expire"}})).status,"CANCELLED");
   await mail.queueMail({...input,key:"retry"});await mail.deliverMail(async()=>{throw new Error("MAIL_HTTP_429");});const retry=await db.emailDelivery.findUniqueOrThrow({where:{key:"retry"}});assert.equal(retry.status,"PENDING");assert.equal(retry.attempts,1);
   await mail.deliverMail(async()=>"retry-ok",new Date(Date.now()+120000));assert.equal((await db.emailDelivery.findUniqueOrThrow({where:{key:"retry"}})).status,"SENT");
  });
  await t.test("Resend configuré : les destinataires fictifs ne quittent pas l’application",async()=>{
   process.env.MAIL_ENABLED="true";process.env.RESEND_API_KEY="fake-test-key";process.env.MAIL_FROM="my@kip-city.com";
   const fetchBefore=globalThis.fetch;
   globalThis.fetch=async()=>{throw new Error("Aucun appel réseau autorisé pour une adresse fictive");};
   try{
    for(const recipient of ["demo@demo.kipcity.test","demo@test.invalid","demo@localhost"]){
     await mail.queueMail({key:`fake:${recipient}`,recipient,kind:"NOTICE",subject:"Test fictif",text:"Sans envoi",expiresAt:new Date(Date.now()+86400000)});
    }
    assert.equal((await mail.deliverMail()).processed,0);
    const rows=await db.emailDelivery.findMany({where:{key:{startsWith:"fake:"}}});
    assert.equal(rows.length,3);assert.ok(rows.every(r=>r.status==="CANCELLED"&&r.attempts===0&&r.payload===""));
   }finally{globalThis.fetch=fetchBefore;process.env.MAIL_ENABLED="false";delete process.env.RESEND_API_KEY;delete process.env.MAIL_FROM;}
  });
  await t.test("Changement d’e-mail : deux confirmations, registre synchronisé, sessions révoquées",async()=>{
   const {requestEmailChange,confirmEmailChange}=await import("../src/lib/email-change");
   await assert.rejects(requestEmailChange("buyer",{email:"new@test.invalid",password:"incorrect"}),{status:403});
   await db.session.create({data:{id:"session",token:"session-token",userId:"buyer",expiresAt:new Date(Date.now()+86400000)}});
   await requestEmailChange("buyer",{email:"new@test.invalid",password});
   const tokens:string[]=[];await mail.deliverMail(async p=>{tokens.push(p.text.match(/token=([a-f0-9]{64})/)![1]);return `change-${tokens.length}`;});assert.equal(tokens.length,2);
   assert.equal((await confirmEmailChange({token:tokens[0]})).complete,false);assert.equal((await db.user.findUniqueOrThrow({where:{id:"buyer"}})).email,"buyer@test.invalid");
   assert.equal((await confirmEmailChange({token:tokens[1]})).complete,true);assert.equal((await db.acquirer.findUniqueOrThrow({where:{id:"buyer"}})).email,"new@test.invalid");assert.equal(await db.session.count({where:{userId:"buyer"}}),0);
   await assert.rejects(confirmEmailChange({token:tokens[0]}),{status:410});
  });
  await t.test("MFA : confirmation TOTP, sessions antérieures et codes de secours",async()=>{
   const {auth}=await import("../src/lib/auth"),{createOTP}=await import("@better-auth/utils/otp"),{symmetricDecrypt}=await import("better-auth/crypto");
   const jar=new Map<string,string>();
   const request=async(path:string,body?:unknown)=>{const response=await auth.handler(new Request(`http://127.0.0.1:3200/api/auth/${path}`,{method:body?"POST":"GET",headers:{origin:"http://127.0.0.1:3200","content-type":"application/json",cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; ")},...(body?{body:JSON.stringify(body)}:{})}));for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(";");const index=pair.indexOf("=");jar.set(pair.slice(0,index),pair.slice(index+1));}return {status:response.status,data:await response.json()};};
   assert.equal((await request("sign-in/email",{email:"agent@test.invalid",password})).status,200);
   const originalToken=(await db.session.findFirstOrThrow({where:{userId:"agent"}})).token;
   const setup=await request("two-factor/enable",{password});assert.equal(setup.status,200);assert.equal((await db.user.findUniqueOrThrow({where:{id:"agent"}})).twoFactorEnabled,false);
   const record=await db.twoFactor.findFirstOrThrow({where:{userId:"agent"}});const secret=await symmetricDecrypt({key:process.env.BETTER_AUTH_SECRET!,data:record.secret});
   assert.equal((await request("two-factor/verify-totp",{code:await createOTP(secret).totp()})).status,200);
   assert.equal((await db.user.findUniqueOrThrow({where:{id:"agent"}})).twoFactorEnabled,true);assert.equal(await db.session.count({where:{token:originalToken}}),0);
   await request("sign-out",{});assert.equal((await request("sign-in/email",{email:"agent@test.invalid",password})).data.twoFactorRedirect,true);assert.equal((await request("get-session")).data,null);
   const backup=setup.data.backupCodes[0];assert.equal((await request("two-factor/verify-backup-code",{code:backup})).status,200);assert.ok((await request("get-session")).data.user);
   await request("sign-out",{});await request("sign-in/email",{email:"agent@test.invalid",password});assert.notEqual((await request("two-factor/verify-backup-code",{code:backup})).status,200);
  });
  await t.test("Récupération Better Auth : lien unique, nouveau mot de passe et suspension",async()=>{
   const {auth}=await import("../src/lib/auth");
   await auth.api.requestPasswordReset({body:{email:"new@test.invalid",redirectTo:"/reinitialiser-mot-de-passe"}});
   let token="";await mail.deliverMail(async p=>{const url=p.text.match(/http[^\s]+/)![0];token=new URL(url).pathname.split("/").at(-1)!;return "reset-id";});assert.ok(token);
   await auth.api.resetPassword({body:{token,newPassword:"Changed-password-123!"}});
   const credential=await db.account.findUniqueOrThrow({where:{id:"account-buyer"}});assert.ok(await verifyPassword({hash:credential.password!,password:"Changed-password-123!"}));
   await assert.rejects(auth.api.resetPassword({body:{token,newPassword:password}}));
   const before=await db.emailDelivery.count();await auth.api.requestPasswordReset({body:{email:"unknown@test.invalid",redirectTo:"/reinitialiser-mot-de-passe"}});assert.equal(await db.emailDelivery.count(),before);
   await db.user.update({where:{id:"buyer"},data:{active:false}});await auth.api.requestPasswordReset({body:{email:"new@test.invalid",redirectTo:"/reinitialiser-mot-de-passe"}});assert.equal(await db.emailDelivery.count(),before);
  });
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});
