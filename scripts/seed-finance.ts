import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
async function main(){
  const id="demo-finance";
  await db.user.upsert({where:{email:"finance@demo.kipcity.test"},update:{},create:{id,name:"Référent Finance",email:"finance@demo.kipcity.test",emailVerified:true,personId:"person-demo-finance",role:"FINANCE_OFFICER",accounts:{create:{id:randomUUID(),accountId:id,providerId:"credential",password:await hashPassword("Demo-Finance-2026!")}}}});
  console.log("Compte Finance local prêt : finance@demo.kipcity.test / Demo-Finance-2026!");
}
main().finally(()=>db.$disconnect());
