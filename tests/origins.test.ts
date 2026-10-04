import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
test('Connexion locale : localhost et 127.0.0.1, session et mutations',async()=>{
 const root=mkdtempSync(join(tmpdir(),'kip-origin-'));
 process.env.DATABASE_URL=`file:${root}/db`;process.env.DEMO_MODE='true';process.env.BETTER_AUTH_URL='http://127.0.0.1:3200';process.env.BETTER_AUTH_SECRET='test-only-local-origin-secret-at-least-32';
 execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:process.env,stdio:'pipe'});
 const {db}=await import('../src/lib/db');const {auth}=await import('../src/lib/auth');const {checkOrigin}=await import('../src/lib/http');const {hashPassword,verifyPassword}=await import('better-auth/crypto');
 try{
 const password='Test-only-Origin-2026!';await db.user.create({data:{id:'test-local',email:'local@test.invalid',name:'Test',personId:'test-local',accounts:{create:{id:'test-account',accountId:'test-local',providerId:'credential',password:await hashPassword(password)}}}});
 let cookieHeader='';
 for(const origin of ['http://localhost:3200','http://127.0.0.1:3200']){
 const response=await auth.handler(new Request(`${origin}/api/auth/sign-in/email`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'local@test.invalid',password})}));
 assert.equal(response.status,200,`${origin}: ${response.status}`);
 const cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.ok(cookie.includes('session_token='));cookieHeader=cookie;
 const session=await auth.handler(new Request(`${origin}/api/auth/get-session`,{headers:{cookie}}));assert.equal((await session.json()).user.id,'test-local');
 assert.doesNotThrow(()=>checkOrigin(new Request(`${origin}/api/profile`,{method:'POST',headers:{origin}})));
 }
 for(const origin of ['http://localhost:3201','https://untrusted.example','http://localhost.attacker.test:3200']){
 const r=await auth.handler(new Request('http://127.0.0.1:3200/api/auth/sign-out',{method:'POST',headers:{origin,cookie:cookieHeader,'content-type':'application/json'},body:'{}'}));assert.equal(r.status,403);assert.throws(()=>checkOrigin(new Request('http://127.0.0.1:3200/api/profile',{method:'POST',headers:{origin}})));
 }
 const origin='http://127.0.0.1:3200';
 const change=(currentPassword:string,newPassword:string)=>auth.handler(new Request(`${origin}/api/auth/change-password`,{method:'POST',headers:{origin,cookie:cookieHeader,'content-type':'application/json'},body:JSON.stringify({currentPassword,newPassword,revokeOtherSessions:true})}));
 assert.equal((await change('incorrect','New-password-test-2026!')).ok,false);
 assert.equal((await change(password,'New-password-test-2026!')).status,200);
 assert.equal(await db.session.count({where:{userId:'test-local'}}),1);
 const account=await db.account.findUniqueOrThrow({where:{id:'test-account'}});
 assert.equal(await verifyPassword({hash:account.password!,password:'New-password-test-2026!'}),true);
 assert.equal(await verifyPassword({hash:account.password!,password}),false);
 }finally{await db.$disconnect();rmSync(root,{recursive:true,force:true});}
});

test('Aucun élargissement des origines hors démonstration locale',async()=>{
 const {applicationOrigins}=await import('../src/lib/origins');
 assert.deepEqual(applicationOrigins('https://kip.example',true),['https://kip.example']);
 assert.deepEqual(applicationOrigins('http://localhost:3200',false),['http://localhost:3200']);
 assert.deepEqual(applicationOrigins('http://localhost:3200',true),['http://localhost:3200','http://127.0.0.1:3200']);
});
