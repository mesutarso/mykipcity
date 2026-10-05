import assert from 'node:assert/strict';
const base='http://127.0.0.1:3200';
const anonymous=await fetch(base+'/mon-dossier',{redirect:'manual'});
if(anonymous.status===307){
 assert.equal(anonymous.headers.get('location'),'/connexion');
}else{
 // Next streaming responses carry the redirect in a meta tag after headers are sent.
 assert.equal(anonymous.status,200);
 const html=await anonymous.text();
 assert.match(html,/<meta id="__next-page-redirect" http-equiv="refresh" content="\d+;url=\/connexion"\s*\/?\s*>/);
 assert.doesNotMatch(html,/Constituer mon dossier|Mes contrats/);
}
const doc=await fetch(base+'/api/documents/unknown');
assert.equal(doc.status,401);
const rejected=await fetch(base+'/api/workflow/save',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.invalid'},body:'{}'});
assert.equal(rejected.status,403);
console.log('HTTP : dossier anonyme redirigé, document anonyme refusé, origine étrangère refusée.');
