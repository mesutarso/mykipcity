import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
async function main(){for(const [id,name,role,email,password] of [["demo-controller","Contrôleur Démo","FINANCE_REVIEWER","controle@demo.kipcity.test","Demo-Controle-2026!"],["demo-validator","Validateur Démo","FINANCE_VALIDATOR","validation@demo.kipcity.test","Demo-Validation-2026!"]]){
 await db.user.upsert({where:{email},update:{},create:{id,name,role,email,personId:`person-${id}`,accounts:{create:{id:randomUUID(),accountId:id,providerId:"credential",password:await hashPassword(password)}}}});console.log(`Compte local prêt : ${email} / ${password}`);
}}
main().finally(()=>db.$disconnect());
