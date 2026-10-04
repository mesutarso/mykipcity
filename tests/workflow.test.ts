import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("Parcours acquéreur et cloisonnement sur une vraie base SQLite", async t => {
  const root = mkdtempSync(join(tmpdir(), "kipcity-test-"));
  process.env.DATABASE_URL = `file:${root}/test.db`;
  process.env.DOCUMENTS_DIR = `${root}/documents`;
  process.env.DEMO_MODE = "true";
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3200";
  process.env.BETTER_AUTH_SECRET = "test-secret-only-123456789012345678901234567890";
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: process.env, stdio: "pipe" });
  const { db } = await import("../src/lib/db");
  const w = await import("../src/lib/workflow");
  const docs = await import("../src/lib/documents");
  const { auth } = await import("../src/lib/auth");
  try {
    await db.user.create({ data: { id: "agent", email: "agent@test.invalid", name: "Agent test", personId: "agent-person", role: "ACQUIRER_AGENT" } });
    for (const ref of ["A01","A02"]) await db.parcel.create({ data: { reference: ref, area: 900, cadastralReference: `FICTIF-${ref}` } });
    const buyers: string[] = [];
    await t.test("WAL, clés étrangères et écriture durable sur la connexion applicative", async () => {
      assert.deepEqual(await db.$queryRawUnsafe("PRAGMA journal_mode"), [{ journal_mode: "wal" }]);
      assert.deepEqual(await db.$queryRawUnsafe("PRAGMA foreign_keys"), [{ foreign_keys: 1n }]);
      assert.deepEqual(await db.$queryRawUnsafe("PRAGMA synchronous"), [{ synchronous: 2n }]);
    });
    await t.test("Invitation révoquée et expirée refusées, activation atomique et rejeu impossible", async () => {
      for (const i of [1,2]) {
        const acq = await db.acquirer.create({ data: { reference: `ACQ${i}`, registeredName: `Démo ${i}`, email: `buyer${i}@test.invalid`, personId: `person${i}` } });
        const old = await w.createInvitation("agent", acq.id);
        const invitation = await w.createInvitation("agent", acq.id);
        assert.equal(await w.invitationInfo(old.url.split("/").at(-1)!), null);
        const token = invitation.url.split("/").at(-1)!;
        await db.invitation.update({ where: { tokenHash: w.tokenHash(token) }, data: { expiresAt: new Date(0) } });
        await assert.rejects(w.activateInvitation({token,name:"Démo test",password:"Password-test-123!",accepted:true}), /expirée/);
        await db.invitation.update({ where: { tokenHash: w.tokenHash(token) }, data: { expiresAt: new Date(Date.now()+60000) } });
        const results = await Promise.allSettled([1,2].map(() => w.activateInvitation({token,name:`Démo ${i}`,password:"Password-test-123!",accepted:true})));
        assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
        assert.equal(await db.user.count({where:{email:acq.email}}),1);
        await assert.rejects(w.activateInvitation({token,name:"Démo test",password:"Password-test-123!",accepted:true}), /expirée/);
        buyers.push((await db.user.findUniqueOrThrow({ where: { email: acq.email } })).id);
      }
    });
    await t.test("Better Auth connecte le compte invité et refuse l’inscription libre", async () => {
      const response = await auth.handler(new Request("http://127.0.0.1:3200/api/auth/sign-in/email", {method:"POST", headers:{"Content-Type":"application/json",origin:process.env.BETTER_AUTH_URL!}, body:JSON.stringify({email:"buyer1@test.invalid",password:"Password-test-123!"})}));
      assert.equal(response.status,200,await response.clone().text());
      assert.ok(response.headers.get("set-cookie")?.includes("session_token"));
      const blocked = await auth.handler(new Request("http://127.0.0.1:3200/api/auth/sign-up/email", {method:"POST",headers:{"Content-Type":"application/json",origin:process.env.BETTER_AUTH_URL!},body:JSON.stringify({email:"unknown@test.invalid",password:"Password-test-123!",name:"Unknown"})}));
      assert.ok(blocked.status >= 400);
      assert.equal(await db.user.count({where:{email:"unknown@test.invalid"}}),0);
    });
    await t.test("Dossier incomplet, doublons et modifications concurrentes refusés", async () => {
      await assert.rejects(w.submitDossier(buyers[0],0), /Complétez/);
      const payload = {version:0,fullName:"Démo un",phone:"000000000",city:"Ville fictive",country:"Pays fictif",parcels:[{reference:"A01",contractNumber:"CONTRAT-FICTIF"},{reference:"A02",contractNumber:"CONTRAT-FICTIF"}]};
      await assert.rejects(w.saveDossier(buyers[0],{...payload,parcels:[payload.parcels[0],payload.parcels[0]]}), /plusieurs fois/);
      await w.saveDossier(buyers[0],payload);
      await assert.rejects(w.saveDossier(buyers[0],payload), /a changé/);
      await assert.rejects(w.createInvitation(buyers[0],"unknown"), /réservée/);
    });
    await t.test("Document privé, contrôle de format et d’intégrité", async () => {
      assert.throws(()=>docs.detectFile(Buffer.from("<script>bad</script>")),/Format/);
      const doc = await docs.depositDocument(buyers[0],"fictif.pdf",Buffer.from("%PDF-1.4\nFICTIF-TEST"));
      await assert.rejects(docs.readDocument(buyers[1],doc.id), /inaccessible/);
      assert.equal((await docs.readDocument(buyers[0],doc.id)).bytes.toString(),"%PDF-1.4\nFICTIF-TEST");
      assert.equal((await docs.readDocument("agent",doc.id)).document.id,doc.id);
    });
    await t.test("Transmission unique et validation partielle avec concurrence contrôlée", async () => {
      let file = await w.ownFile(buyers[0]);
      await w.submitDossier(buyers[0],file.version);
      await assert.rejects(w.submitDossier(buyers[0],file.version), /déjà transmis/);
      assert.equal(await db.auditEvent.count({where:{objectId:file.id,action:"DOSSIER_SUBMITTED"}}),1);
      file = await w.ownFile(buyers[0]);
      const review = {declarationId:file.declarations[0].id,version:file.version,decision:"APPROVED",reason:"Pièces fictives contrôlées",checkedDocuments:true};
      await assert.rejects(w.reviewDeclaration(buyers[0],review), /réservée/);
      const results = await Promise.allSettled([1,2].map(()=>w.reviewDeclaration("agent",review)));
      assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
      file = await w.ownFile(buyers[0]);
      assert.equal(file.status,"SUBMITTED");
      assert.equal(file.declarations.filter(p=>p.status==="APPROVED").length,1);
      assert.equal(file.declarations.find(p=>p.status==="PENDING")!.parcel,null);
      await assert.rejects(w.reviewDeclaration("agent",{...review,declarationId:file.declarations[1].id}), /modifié/);
      await w.reviewDeclaration("agent",{...review,version:file.version,declarationId:file.declarations[1].id,decision:"NEEDS_INFO"});
      file = await w.ownFile(buyers[0]);
      assert.equal(file.status,"NEEDS_INFO");
      await w.saveDossier(buyers[0],{version:file.version,fullName:file.fullName,phone:file.phone,city:file.city,country:file.country,parcels:file.declarations.map(p=>({reference:p.reference,contractNumber:p.contractNumber}))});
      file = await w.ownFile(buyers[0]);
      await w.submitDossier(buyers[0],file.version);
      file = await w.ownFile(buyers[0]);
      await w.reviewDeclaration("agent",{...review,version:file.version,declarationId:file.declarations[1].id,decision:"REJECTED"});
      assert.equal((await w.ownFile(buyers[0])).status,"VERIFIED");
    });
    await t.test("Même parcelle non attribuable à un deuxième dossier dans cette démo", async () => {
      await w.saveDossier(buyers[1],{version:0,fullName:"Démo deux",phone:"000",city:"Fictif",country:"Fictif",parcels:[{reference:"A01",contractNumber:"FICTIF"}]});
      await docs.depositDocument(buyers[1],"contrat.pdf",Buffer.from("%PDF-1.4 FICTIF"));
      let file=await w.ownFile(buyers[1]);await w.submitDossier(buyers[1],file.version);file=await w.ownFile(buyers[1]);
      await assert.rejects(w.reviewDeclaration("agent",{declarationId:file.declarations[0].id,version:file.version,decision:"APPROVED",reason:"Examen fictif",checkedDocuments:true}), /examen de l’équipe/);
      await db.user.update({where:{id:buyers[1]},data:{active:false}});
      await assert.rejects(w.ownFile(buyers[1]), /suspendu/);
    });
    await t.test("Gestion des acquéreurs et parcelles : droits, doublons et traçabilité", async () => {
      const m = await import("../src/lib/management");
      const input = {reference:"acq-new",name:"Nouveau Test",email:"NEW@test.invalid"};
      await assert.rejects(m.registerAcquirer(buyers[0],input), /réservée/);
      const result = await m.registerAcquirer("agent",input);
      const saved = await db.acquirer.findUniqueOrThrow({where:{id:result.id}});
      assert.equal(saved.reference,"ACQ-NEW"); assert.equal(saved.email,"new@test.invalid");
      await assert.rejects(m.registerAcquirer("agent",input),/existe déjà/);
      await assert.rejects(m.registerAcquirer("agent",{...input,reference:"DIFFERENT",email:"buyer1@test.invalid"}),/déjà associée/);
      const parcel={reference:"new-01",area:500,cadastralReference:"CAD-NEW-01"};
      await assert.rejects(m.registerParcel(buyers[0],parcel),/réservée/);
      await m.registerParcel("agent",parcel);
      await assert.rejects(m.registerParcel("agent",parcel),/déjà/);
      await assert.rejects(m.registerParcel("agent",{...parcel,reference:"BAD",area:-1}));
      assert.equal(await db.auditEvent.count({where:{action:"ACQUIRER_REGISTERED",objectId:result.id}}),1);
    });
    await t.test("Messages privés : échanges persistés, isolation et contrôle des entrées", async () => {
      const m = await import("../src/lib/management");
      const file=await w.ownFile(buyers[0]);
      await m.sendMessage(buyers[0],{fileId:file.id,body:"Bonjour, où en est mon dossier ?"});
      await m.sendMessage("agent",{fileId:file.id,body:"Votre dossier a été vérifié."});
      assert.equal(await db.message.count({where:{fileId:file.id}}),2);
      await db.user.update({where:{id:buyers[1]},data:{active:true}});
      await assert.rejects(m.conversation(buyers[1],file.id),/inaccessible/);
      await assert.rejects(m.sendMessage(buyers[1],{fileId:file.id,body:"intrusion"}),/inaccessible/);
      await assert.rejects(m.sendMessage(buyers[0],{fileId:file.id,body:"   "}));
      await assert.rejects(m.sendMessage(buyers[0],{fileId:file.id,body:"a".repeat(4001)}));
      assert.equal(await db.message.count({where:{fileId:file.id}}),2);
    });
  } finally { await db.$disconnect(); rmSync(root,{recursive:true,force:true}); }
});
