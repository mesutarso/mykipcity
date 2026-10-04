import {db} from "@/lib/db";
import {DossierSelector} from "./acquirer-change-forms";
export async function MemberDossierSelector({userId,fileId}:{userId:string;fileId:string}){
 const files=await db.acquirerFile.findMany({where:{acquirer:{userId}},select:{id:true,acquirer:{select:{reference:true,registeredName:true}}},orderBy:{id:"asc"}});
 return <DossierSelector current={fileId} files={files.map(f=>({id:f.id,label:`${f.acquirer.reference} · ${f.acquirer.registeredName}`}))}/>;
}
