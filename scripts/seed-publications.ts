import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
async function main(){
 const id="demo-publication-reviewer",email="relecture@demo.kipcity.test";
 await db.user.upsert({where:{email},update:{},create:{id,email,name:"Relecture Démo",personId:"person-demo-publication-reviewer",role:"ACQUIRER_AGENT",accounts:{create:{id:randomUUID(),accountId:id,providerId:"credential",password:await hashPassword("Demo-Relecture-2026!")}}}});
 console.log("Compte local prêt : relecture@demo.kipcity.test / Demo-Relecture-2026!");
}
main().finally(()=>db.$disconnect());
