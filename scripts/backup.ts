import "dotenv/config";
import Database from "better-sqlite3";
import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile,copyFile,chmod,lstat,rm} from "node:fs/promises";
import {resolve,join,dirname,relative,isAbsolute,sep} from "node:path";

type Entry={path:string;sha256:string;size:number};
type Manifest={format:1;createdAt:string;database:Entry;documents:Entry[]};
const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
function safePath(root:string,path:string){if(isAbsolute(path)||path.split(/[\\/]/).some(p=>!p||p==="."||p===".."))throw new Error("Chemin de sauvegarde invalide.");return join(root,path);}
function isInside(parent:string,child:string){const rel=relative(parent,child);return rel===""||(!rel.startsWith(`..${sep}`)&&rel!==".."&&!isAbsolute(rel));}
async function noSymlinks(root:string,path:string){let current=resolve(root);if((await lstat(current)).isSymbolicLink())throw new Error("Les liens symboliques ne sont pas admis.");for(const part of path.split("/")){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw new Error("Les liens symboliques ne sont pas admis.");}}
function inventory(databasePath:string):Entry[]{
 const sqlite=new Database(databasePath,{readonly:true,fileMustExist:true});
 try{
  if(sqlite.pragma("integrity_check",{simple:true})!=="ok")throw new Error("La base doit être vérifiée avant sauvegarde.");
  const has=(name:string)=>Boolean(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
  const result:Entry[]=[];
  for(const [table,query] of [
   ["Document",'SELECT storageKey AS path, sha256, size FROM Document'],
   ["OriginalEvent",`SELECT 'originals/' || storageKey AS path, sha256, size FROM OriginalEvent`],
   ["LoanEvent",`SELECT 'loans/' || storageKey AS path, sha256, size FROM LoanEvent`],
   ["FinanceDocument",`SELECT 'finance/' || storageKey AS path, sha256, size FROM FinanceDocument`],
   ["MemberDocumentVersion",`SELECT 'mykipcity/' || d.fileId || '/' || v.documentId || '/' || v.storageKey AS path, v.sha256, v.size FROM MemberDocumentVersion v JOIN MemberDocument d ON d.id=v.documentId`],
   ["PublicationAttachment",`SELECT 'publications/' || publicationId || '/' || storageKey AS path, sha256, size FROM PublicationAttachment`],
  ])if(has(table))result.push(...sqlite.prepare(query).all() as Entry[]);
  if(has("Message")&&(sqlite.prepare('PRAGMA table_info("Message")').all() as {name:string}[]).some(c=>c.name==="uploadStorageKey"))result.push(...sqlite.prepare("SELECT 'messages/' || uploadStorageKey AS path, uploadSha256 AS sha256, uploadSize AS size FROM Message WHERE uploadStorageKey IS NOT NULL").all() as Entry[]);
  return result.sort((a,b)=>a.path.localeCompare(b.path));
 }finally{sqlite.close();}
}
async function verifyFile(root:string,entry:Entry){const path=safePath(root,entry.path);await noSymlinks(root,entry.path);const bytes=await readFile(path);if(bytes.length!==entry.size||hash(bytes)!==entry.sha256)throw new Error(`Copie absente ou altérée : ${entry.path}`);}
export async function createBackup(databasePath:string,documentsRoot:string,destination:string){
 databasePath=resolve(databasePath);documentsRoot=resolve(documentsRoot);destination=resolve(destination);
 if(isInside(documentsRoot,destination)||isInside(destination,databasePath)||isInside(destination,documentsRoot))throw new Error("Choisissez un répertoire de sauvegarde distinct de la base et des documents.");
 await mkdir(destination,{mode:0o700});
 try{
  const target=join(destination,"database.sqlite");const source=new Database(databasePath,{readonly:true,fileMustExist:true});
  try{await source.backup(target);}finally{source.close();}await chmod(target,0o600);
  const documents=inventory(target);await mkdir(join(destination,"documents"),{mode:0o700});
  for(const entry of documents){await verifyFile(documentsRoot,entry);const to=safePath(join(destination,"documents"),entry.path);await mkdir(dirname(to),{recursive:true,mode:0o700});await copyFile(safePath(documentsRoot,entry.path),to);await chmod(to,0o600);await verifyFile(join(destination,"documents"),entry);}
  const bytes=await readFile(target);const manifest:Manifest={format:1,createdAt:new Date().toISOString(),database:{path:"database.sqlite",sha256:hash(bytes),size:bytes.length},documents};
  await writeFile(join(destination,"manifest.json"),JSON.stringify(manifest,null,2),{flag:"wx",mode:0o600});
  await verifyBackup(destination);return {directory:destination,documents:documents.length};
 }catch(e){await rm(destination,{recursive:true,force:true});throw e;}
}
export async function verifyBackup(source:string){
 const manifest=JSON.parse(await readFile(join(source,"manifest.json"),"utf8")) as Manifest;
 if(manifest.format!==1||manifest.database.path!=="database.sqlite"||!Array.isArray(manifest.documents))throw new Error("Format de sauvegarde non reconnu.");
 await verifyFile(source,manifest.database);
 if(JSON.stringify(inventory(join(source,"database.sqlite")))!==JSON.stringify(manifest.documents))throw new Error("Le manifeste ne correspond pas aux documents de la base.");
 for(const entry of manifest.documents)await verifyFile(join(source,"documents"),entry);
 return manifest;
}
export async function restoreBackup(source:string,destination:string){
 source=resolve(source);destination=resolve(destination);if(isInside(source,destination)||isInside(destination,source))throw new Error("La restauration doit utiliser un nouveau répertoire distinct.");
 const manifest=await verifyBackup(source);await mkdir(destination,{mode:0o700});
 try{
  await copyFile(join(source,"database.sqlite"),join(destination,"database.sqlite"));await chmod(join(destination,"database.sqlite"),0o600);
  await mkdir(join(destination,"documents"),{mode:0o700});
  for(const entry of manifest.documents){const to=safePath(join(destination,"documents"),entry.path);await mkdir(dirname(to),{recursive:true,mode:0o700});await copyFile(safePath(join(source,"documents"),entry.path),to);await chmod(to,0o600);await verifyFile(join(destination,"documents"),entry);}
  await verifyFile(destination,manifest.database);return {directory:destination,documents:manifest.documents.length};
 }catch(e){await rm(destination,{recursive:true,force:true});throw e;}
}
async function main(){
 const [command,...args]=process.argv.slice(2);
 try{
  if(command==="create"){
   if(!process.env.DATABASE_URL?.startsWith("file:"))throw new Error("DATABASE_URL SQLite requise.");
   const destination=args[0]??`./data/backups/${new Date().toISOString().replaceAll(":","-")}`;
   await mkdir(dirname(resolve(destination)),{recursive:true,mode:0o700});
   console.log(await createBackup(process.env.DATABASE_URL.slice(5),process.env.DOCUMENTS_DIR??"./data/documents",destination));
  }else if(command==="verify"&&args[0]){const m=await verifyBackup(resolve(args[0]));console.log(`Sauvegarde vérifiée : ${m.documents.length} fichiers.`);}
  else if(command==="restore"&&args[0]&&args[1])console.log(await restoreBackup(args[0],args[1]));
  else throw new Error("Usage : backup.ts create [destination] | verify <sauvegarde> | restore <sauvegarde> <nouveau répertoire>");
 }catch(e){console.error(e instanceof Error?e.message:"Échec de sauvegarde.");process.exitCode=1;}
}

if(typeof require!=="undefined"&&require.main===module)void main();
