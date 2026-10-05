import { isAbsolute, relative, resolve, sep } from "node:path";

export type EnvironmentCheck = { name:string; ok:boolean; detail:string };
export function checkEnvironment(env:Record<string,string|undefined>, hosted=false, root=process.cwd()):EnvironmentCheck[] {
  const checks:EnvironmentCheck[]=[];
  const check=(name:string,ok:boolean,detail:string)=>checks.push({name,ok,detail});
  let url:URL|undefined;
  try { url=new URL(env.BETTER_AUTH_URL??""); } catch {}
  const loopback=!!url&&["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  check("Adresse de l’application",!!url&&["http:","https:"].includes(url.protocol)&&!url.username&&!url.password&&url.pathname==="/"&&!url.search&&!url.hash&&(!hosted||(url.protocol==="https:"&&!loopback&&!url.hostname.endsWith(".invalid"))),hosted?"Une origine HTTPS réelle est requise pour le pilote distant.":"Une origine HTTP(S) sans chemin ni identifiants est requise.");
  const secret=env.BETTER_AUTH_SECRET??"";
  check("Secret d’authentification",secret.length>=32&&!/replace-with|change-me|your-secret/i.test(secret),"Secret privé d’au moins 32 caractères, différent du modèle.");
  check("MFA interne",env.REQUIRE_STAFF_MFA!=="false","La double authentification interne doit rester obligatoire.");
  check("Périmètre de démonstration",env.DEMO_MODE==="true","Le code actuel exige des données fictives ; ce contrôle n’autorise pas de vrais dossiers.");
  const database=env.DATABASE_URL?.startsWith("file:")?env.DATABASE_URL.slice(5):"";
  const documents=env.DOCUMENTS_DIR??"./data/documents";
  const inside=(parent:string,child:string)=>{const path=relative(resolve(parent),resolve(root,child));return path===""||(!path.startsWith(`..${sep}`)&&path!==".."&&!isAbsolute(path));};
  check("Base SQLite privée",!!database&&!database.includes("?")&&!inside(resolve(root,"public"),database)&&(!hosted||isAbsolute(database)),hosted?"Utiliser un chemin absolu sur disque local persistant, hors public/.":"Utiliser une base SQLite locale hors public/.");
  check("Documents privés",!!documents&&!inside(resolve(root,"public"),documents)&&(!hosted||isAbsolute(documents)),hosted?"Utiliser un chemin absolu sur disque persistant, hors public/.":"Les documents doivent rester hors public/.");
  const mail=env.MAIL_ENABLED==="true";
  const from=env.MAIL_FROM?.trim()??"";
  check("Transport Resend",(!hosted&&!mail)||(mail&&!!env.RESEND_API_KEY?.trim()&&/^(?:[^<>\r\n]+ <)?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/.test(from)),"Le pilote distant exige le transport activé, la clé privée et un expéditeur configuré.");
  check("Traitement des e-mails",!hosted||env.MAIL_AUTORUN==="true","Le processus Next.js du pilote doit traiter la file automatiquement.");
  const publicSecrets=Object.keys(env).some(key=>key.startsWith("NEXT_PUBLIC_")&&/(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|RESEND_API)/i.test(key)&&!!env[key]);
  check("Absence de secret public",!publicSecrets,"Aucun secret ne doit utiliser le préfixe NEXT_PUBLIC_.");
  return checks;
}
