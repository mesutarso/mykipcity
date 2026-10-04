import "dotenv/config";
import {prepareReminders} from "../src/lib/reminders";
import {deliverMail,mailReadiness} from "../src/lib/mail";
import {db} from "../src/lib/db";
async function main(){
 try{const action=process.argv[2];if(action==="status")console.log(mailReadiness());else if(action==="prepare")console.log(await prepareReminders());else if(action==="send")console.log(await deliverMail());else if(action==="run"){console.log(await prepareReminders());console.log(await deliverMail());}else throw new Error("Utilisation : bun run mail status|prepare|send|run");}finally{await db.$disconnect();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Commande e-mail impossible.");process.exitCode=1;});
