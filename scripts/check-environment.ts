import "dotenv/config";
import { existsSync, statSync, constants, accessSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { checkEnvironment, type EnvironmentCheck } from "./environment-checks";

const args=process.argv.slice(2);
if(args.some(arg=>arg!=="--hosted")){
 console.error("Utilisation : bun run check:environment [--hosted]");process.exitCode=1;
}else{
 const hosted=args.includes("--hosted");
 const checks:EnvironmentCheck[]=checkEnvironment(process.env,hosted);
 const database=process.env.DATABASE_URL?.startsWith("file:")?resolve(process.env.DATABASE_URL.slice(5)):null;
 const documents=resolve(process.env.DOCUMENTS_DIR??"./data/documents");
 const writable=(path:string)=>{try{accessSync(path,constants.R_OK|constants.W_OK);return true;}catch{return false;}};
 checks.push({name:"Base existante et accessible",ok:!!database&&existsSync(database)&&statSync(database).isFile()&&writable(database)&&writable(dirname(database)),detail:"Migrer la base dans son emplacement privé avant le démarrage ; aucun fichier n’est créé ici."});
 checks.push({name:"Répertoire de documents accessible",ok:existsSync(documents)&&statSync(documents).isDirectory()&&writable(documents),detail:"Le compte exécutant l’application doit pouvoir lire et déposer les fichiers privés."});
 checks.push({name:"Compilation disponible",ok:existsSync(resolve(".next/BUILD_ID")),detail:"Exécuter bun run build après toute modification du code."});
 for(const item of checks)console.log(`${item.ok?"OK":"À CORRIGER"} — ${item.name}${item.ok?"":` : ${item.detail}`}`);
 const failures=checks.filter(item=>!item.ok).length;
 console.log(`${checks.length-failures}/${checks.length} contrôles réussis. Aucune valeur secrète affichée ; aucune modification effectuée.`);
 console.log("La persistance réelle du disque, HTTPS, les sauvegardes externes et la recette client restent à vérifier sur l’hébergement.");
 process.exitCode=failures?1:0;
}
