"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export function ReadNotifications({ids,label="Marquer comme lu"}:{ids:string[];label?:string}){
 const router=useRouter();const[pending,setPending]=useState(false);const[error,setError]=useState("");
 return <div><button className="button secondary compact" disabled={pending||!ids.length} onClick={async()=>{setPending(true);setError("");try{const r=await fetch("/api/notifications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids})});const v=await r.json();if(!r.ok)throw new Error(v.error);router.refresh();}catch(e){setError(e instanceof Error?e.message:"Enregistrement impossible.");}finally{setPending(false);}}}>{pending?"Enregistrement…":label}</button>{error&&<p className="feedback error" role="alert">{error}</p>}</div>;
}
