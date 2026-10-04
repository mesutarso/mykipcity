import assert from "node:assert/strict";
const base="http://127.0.0.1:3200";
async function login(email,password){
 const response=await fetch(`${base}/api/auth/sign-in/email`,{method:"POST",headers:{"Content-Type":"application/json",Origin:base},body:JSON.stringify({email,password})});
 assert.equal(response.status,200);
 return response.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
}
const agent=await login("agent@demo.kipcity.test","Demo-KipCity-2026!");
const rejected=await fetch(`${base}/api/finance/create`,{method:"POST",headers:{"Content-Type":"application/json",Origin:base,Cookie:agent},body:"{}"});
assert.equal(rejected.status,403);
const finance=await login("finance@demo.kipcity.test","Demo-Finance-2026!");
for(const route of ["/gestion/acquereurs","/mykipcity","/mon-dossier"]){
 const response=await fetch(base+route,{headers:{Cookie:finance},redirect:"manual"});assert.equal(response.status,307);assert.equal(response.headers.get("location"),"/finance");
}
const page=await fetch(`${base}/finance`,{headers:{Cookie:finance}});assert.equal(page.status,200);
console.log("HTTP Finance : agent refusé, compte Finance connecté et redirections sans boucle.");
