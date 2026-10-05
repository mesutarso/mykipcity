import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEnvironment } from "../scripts/environment-checks";

const env={BETTER_AUTH_URL:"https://pilote.kip-city.com",BETTER_AUTH_SECRET:"fictive-test-secret-for-config-checks-only-2026",DEMO_MODE:"true",REQUIRE_STAFF_MFA:"true",DATABASE_URL:"file:/srv/mykipcity/data/app.sqlite",DOCUMENTS_DIR:"/srv/mykipcity/data/documents",MAIL_ENABLED:"true",MAIL_AUTORUN:"true",MAIL_FROM:"my@kip-city.com",RESEND_API_KEY:"fictive-key"};
test("Pilote : configuration cohérente acceptée sans valeurs secrètes dans le résultat",()=>{
 const checks=checkEnvironment(env,true,"/srv/mykipcity/app");assert.ok(checks.every(c=>c.ok));
 assert.ok(!JSON.stringify(checks).includes(env.BETTER_AUTH_SECRET));assert.ok(!JSON.stringify(checks).includes(env.RESEND_API_KEY));
});
test("Pilote : URL locale, chemins relatifs et protections désactivées signalés",()=>{
 const checks=checkEnvironment({...env,BETTER_AUTH_URL:"http://127.0.0.1:3200",DATABASE_URL:"file:./data/db",DOCUMENTS_DIR:"./data/documents",REQUIRE_STAFF_MFA:"false",MAIL_AUTORUN:"false"},true);
 assert.equal(checks.filter(c=>!c.ok).length,5);
});
test("Configuration : modèle, répertoire public et secret exposé sont refusés",()=>{
 const checks=checkEnvironment({...env,BETTER_AUTH_SECRET:"replace-with-a-random-secret-of-at-least-32-characters",DATABASE_URL:"file:/srv/app/public/app.db",DOCUMENTS_DIR:"/srv/app/public/uploads",NEXT_PUBLIC_RESEND_API_KEY:"not-a-real-key"},false,"/srv/app");
 assert.equal(checks.filter(c=>!c.ok).length,4);
});
test("Configuration : une URL avec identifiants ou chemin n’est pas une origine valide",()=>{
 for(const url of ["https://user:password@kip-city.com","https://kip-city.com/mykipcity","invalid"]){assert.equal(checkEnvironment({...env,BETTER_AUTH_URL:url})[0].ok,false);}
});
