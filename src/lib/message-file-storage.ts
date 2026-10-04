import {mkdir,writeFile,unlink,readFile} from "node:fs/promises";
import {join,resolve,relative,sep} from "node:path";
import {randomUUID,createHash} from "node:crypto";
import {detectFile} from "./documents";
import {WorkflowError} from "./workflow";
function directory(){const root=resolve(/* turbopackIgnore: true */ process.env.DOCUMENTS_DIR??"./data/documents");const rel=relative(resolve("public"),root);if(rel===""||(!rel.startsWith(`..${sep}`)&&rel!==".."&&!rel.startsWith(sep)))throw new WorkflowError("Le stockage des messages doit rester privé.",500);return join(/* turbopackIgnore: true */ root,"messages");}
export async function storeMessageFile(name:string,bytes:Buffer){
 const uploadMime=detectFile(bytes),uploadStorageKey=randomUUID(),uploadName=name.replace(/[\x00-\x1f\x7f/\\]/g,"_").slice(0,160)||"document";
 await mkdir(directory(),{recursive:true,mode:0o700});await writeFile(join(/* turbopackIgnore: true */ directory(),uploadStorageKey),bytes,{flag:"wx",mode:0o600});
 return {uploadMime,uploadStorageKey,uploadName,uploadSize:bytes.length,uploadSha256:createHash("sha256").update(bytes).digest("hex")};
}
export async function deletePreparedMessageFile(key:string){await unlink(join(/* turbopackIgnore: true */ directory(),key));}
export async function messageFileBytes(key:string,sha256:string,size:number){if(!/^[a-f0-9-]{36}$/.test(key))throw new WorkflowError("Pièce jointe indisponible.",404);const bytes=await readFile(join(/* turbopackIgnore: true */ directory(),key));if(bytes.length!==size||createHash("sha256").update(bytes).digest("hex")!==sha256)throw new WorkflowError("La pièce jointe doit être vérifiée par l’équipe.",409);return bytes;}
