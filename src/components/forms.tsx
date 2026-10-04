"use client";
import {ParcelAccessFields,readAccessForm,type AccessProof} from "./parcel-access-fields";
import type {AccessVerification} from "@/lib/parcel-access-model";
/* eslint-disable @next/next/no-location-assign-relative-destination -- Full reload deliberately clears the router cache across authentication changes. */
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {authClient} from "@/lib/auth-client";
import { ArrowRight, LoaderCircle, Copy, Check, Upload } from "lucide-react";

async function post(action: string, body: unknown) {
  const response = await fetch(`/api/workflow/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "L’opération a échoué.");
  return data;
}
function Feedback({ error, success }: { error?: string; success?: string }) {
  return <>{error && <p className="feedback error" role="alert">{error}</p>}{success && <p className="feedback success" role="status">{success}</p>}</>;
}
function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return <button className="button" disabled={pending} type="submit">{pending ? <LoaderCircle className="spin" size={17} aria-hidden /> : null}{children}{!pending && <ArrowRight size={17} aria-hidden />}</button>;
}
export function LoginForm() {
  const [pending,setPending] = useState(false); const [error,setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); const data = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) });
      if (result.error) {
        const code=result.error.code;
        if(code==="INVALID_EMAIL_OR_PASSWORD")throw new Error("Adresse ou mot de passe incorrect. Vérifiez vos identifiants.");
        if(code==="INVALID_ORIGIN")throw new Error("Cette adresse d’accès n’est pas autorisée. Ouvrez l’application depuis son adresse configurée.");
        if(result.error.status===429)throw new Error("Trop de tentatives. Patientez une minute avant de réessayer.");
        throw new Error("Connexion indisponible. Réessayez dans un instant.");
      }
      window.location.assign(result.data&&"twoFactorRedirect" in result.data&&result.data.twoFactorRedirect?"/double-authentification":"/");
    } catch(e) { setError(e instanceof Error ? e.message : "Connexion indisponible."); setPending(false); }
  }
  return <form onSubmit={submit} className="form-stack"><label>Adresse e-mail<input name="email" type="email" autoComplete="username" required placeholder="vous@exemple.com" /></label><label>Mot de passe<input name="password" type="password" autoComplete="current-password" required /></label><Feedback error={error}/><Submit pending={pending}>Se connecter</Submit><a className="text-link" href="/mot-de-passe-oublie">Mot de passe oublié ?</a><p className="muted small">L’accès acquéreur s’ouvre uniquement sur invitation de l’équipe Kip-City.</p></form>;
}
export function Logout() {
  return <button className="logout" onClick={async () => { await authClient.signOut(); window.location.assign("/connexion"); }}>Se déconnecter</button>;
}
export function ActivationForm({ token,email }: {token:string;email:string}) {
  const [pending,setPending]=useState(false);const [error,setError]=useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data=new FormData(event.currentTarget);setPending(true);setError("");
    try {
      if (data.get("password")!==data.get("confirmation")) throw new Error("Les deux mots de passe ne correspondent pas.");
      const password=String(data.get("password"));
      await post("activate",{token,name:data.get("name"),password,accepted:data.get("accepted")==="on"});
      const result=await authClient.signIn.email({email,password});
      window.location.assign(result.error ? "/connexion?created=1" : "/mon-dossier");
    }catch(e){setError(e instanceof Error?e.message:"Création impossible.");setPending(false);}
  }
  return <form onSubmit={submit} className="form-stack"><label>Adresse invitée<input value={email} readOnly type="email" /></label><label>Nom complet<input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label><label>Mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/><span className="hint">12 caractères minimum.</span></label><label>Confirmer le mot de passe<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} /></label><label className="check-label"><input name="accepted" type="checkbox" required/><span>J’accepte les <a href="/conditions" target="_blank" rel="noreferrer">conditions d’accès</a>.</span></label><Feedback error={error}/><Submit pending={pending}>Créer mon compte</Submit></form>;
}
export { DossierForm } from "./dossier-form";
export function DocumentUpload({editable}:{editable:boolean}){
  const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState("");const [success,setSuccess]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;setPending(true);setError("");setSuccess("");
    try{const response=await fetch("/api/documents",{method:"POST",body:new FormData(form)});const result=await response.json();if(!response.ok)throw new Error(result.error);setSuccess("Document déposé. L’équipe pourra l’examiner.");form.reset();router.refresh();}catch(e){setError(e instanceof Error?e.message:"Dépôt impossible.");}finally{setPending(false);}}
  return editable?<form className="form-stack" onSubmit={submit}><label className="upload"><Upload size={23} aria-hidden/><strong>Ajouter un contrat</strong><span className="muted small">PDF, JPEG ou PNG · 8 Mo maximum</span><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png" required aria-label="Choisir un contrat"/></label><Feedback error={error} success={success}/><Submit pending={pending}>Déposer le document</Submit></form>:null;
}
export function SubmitDossier({version,enabled,fileId}:{version:number;enabled:boolean;fileId?:string}){
  const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState("");
  return <form className="form-stack" onSubmit={async e=>{e.preventDefault();setPending(true);setError("");try{await post("submit",{fileId,version,accepted:true});router.refresh();}catch(e){setError(e instanceof Error?e.message:"Transmission impossible.");}finally{setPending(false);}}}><label className="check-label"><input type="checkbox" required disabled={!enabled}/><span>Je confirme de bonne foi les déclarations enregistrées dans mon dossier.</span></label><Feedback error={error}/><button type="submit" className="button" disabled={!enabled||pending}>{pending?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>}Transmettre à l’équipe</button><p className="muted small">Enregistrez vos modifications avant de transmettre. Le dépôt d’un contrat ne valide pas votre rattachement.</p></form>;
}
export function InvitationControls({acquirerId,invitationId}:{acquirerId:string;invitationId?:string}){
  const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState("");const [url,setUrl]=useState("");const [copied,setCopied]=useState(false);
  async function action(revoke=false){setPending(true);setError("");try{const result=await post(revoke?"revoke":"invite",revoke?{invitationId}:{acquirerId});setUrl(result.url??"");setCopied(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:"Invitation impossible.");}finally{setPending(false);}}
  return <div className="form-stack"><div className="actions"><button className="button compact" disabled={pending} onClick={()=>action()}>{invitationId?"Réémettre l’invitation":"Créer l’invitation"}<ArrowRight size={15}/></button>{invitationId&&<button className="button secondary compact" disabled={pending} onClick={()=>action(true)}>Révoquer</button>}</div><Feedback error={error}/>{url&&<div className="invite-result"><label>Lien d’invitation à transmettre à l’acquéreur<input readOnly value={url}/></label><div className="actions"><button className="button secondary compact" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);}catch{setError("Copiez le lien affiché dans le champ.");}}}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?"Copié":"Copier"}</button><a href={url} className="text-link">Ouvrir l’invitation</a></div></div>}</div>;
}
export function ReviewForm({declarationId,version,quality="HOLDER",proofs=[]}:{declarationId:string;version:number;quality?:AccessVerification["quality"];proofs?:AccessProof[]}){
  const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);setPending(true);setError("");try{await post("review",{declarationId,version,access:data.get("decision")==="APPROVED"?readAccessForm(data,quality):undefined,decision:data.get("decision"),registryReference:data.get("registryReference")||undefined,reason:data.get("reason"),checkedDocuments:data.get("checked")==="on"});router.refresh();}catch(e){setError(e instanceof Error?e.message:"Décision impossible.");}finally{setPending(false);}}
  return <form onSubmit={submit} className="review-form"><label>Décision<select name="decision"><option value="NEEDS_INFO">Demander un complément</option><option value="APPROVED">Valider le rattachement</option><option value="REJECTED">Refuser le rattachement</option></select></label><label>Référence rapprochée dans le registre — si différente<input name="registryReference" maxLength={60} placeholder="Référence confirmée après examen"/></label><ParcelAccessFields quality={quality} proofs={proofs}/><label>Motif<textarea name="reason" required minLength={8} maxLength={1000} rows={2}/></label><label className="check-label"><input type="checkbox" name="checked" required/><span>J’ai examiné les pièces du dossier et le registre des parcelles.</span></label><Feedback error={error}/><Submit pending={pending}>Enregistrer la décision</Submit></form>;
}

export function RegistryForm({ kind }: { kind: "acquirer" | "parcel" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = event.currentTarget; const data = new FormData(form);
    const body = kind === "acquirer"
      ? { reference: data.get("reference"), name: data.get("name"), email: data.get("email") }
      : { reference: data.get("reference"), area: Number(data.get("area")), cadastralReference: data.get("cadastralReference") };
    try {
      await post(`register-${kind}`, body);
      router.push(kind === "acquirer" ? "/gestion/acquereurs?created=1" : "/gestion/parcelles?created=1");
      router.refresh();
    } catch(e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); setPending(false); }
  }
  return <form onSubmit={submit} className="form-stack"><label>Référence {kind === "acquirer" ? "acquéreur" : "parcelle"}<input name="reference" required minLength={2} maxLength={60} autoComplete="off" /></label>{kind === "acquirer" ? <><label>Nom complet<input name="name" required minLength={2} maxLength={120}/></label><label>Adresse e-mail<input name="email" type="email" required maxLength={254}/></label></> : <><label>Superficie (m²)<input name="area" type="number" min={1} max={100000000} step={1} required/></label><label>Référence cadastrale<input name="cadastralReference" required minLength={2} maxLength={120}/></label></>}<Feedback error={error}/><Submit pending={pending}>Enregistrer</Submit></form>;
}
export function MessageForm({fileId,parcels=[],attachments=[]}:{fileId:string;parcels?:string[];attachments?:{id:string;label:string}[]}) {
 const router=useRouter();const[pending,setPending]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(""),[mode,setMode]=useState("none"),[clientToken,setClientToken]=useState("");
 return <form className="form-stack" onChange={()=>{setClientToken("");setSuccess("");}} onSubmit={async event=>{
  event.preventDefault();const form=event.currentTarget,values=new FormData(form),token=clientToken||crypto.randomUUID();setClientToken(token);setPending(true);setError("");setSuccess("");
  try{
   if(mode==="file"){
    const file=values.get("file");if(!(file instanceof File)||!file.size||file.size>8*1024*1024)throw new Error("Choisissez un fichier de 8 Mo maximum.");
    values.set("fileId",fileId);values.set("clientToken",token);
    const response=await fetch("/api/messages/upload",{method:"POST",body:values});const result=await response.json();if(!response.ok)throw new Error(result.error??"Envoi impossible.");
   }else await post("message",{fileId,body:values.get("body"),subject:values.get("subject"),parcelReference:values.get("parcelReference"),attachmentId:mode==="existing"?values.get("attachmentId"):null,clientToken:token});
   form.reset();setMode("none");setClientToken("");setSuccess("Votre message a été envoyé.");router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Envoi impossible. Vous pouvez réessayer.");}finally{setPending(false);}
 }}><fieldset className="form-stack" disabled={pending}><div className="form-grid"><label>Objet<input name="subject" required maxLength={160}/></label><label>Concernant<select name="parcelReference"><option value="">Mon dossier</option>{parcels.map(p=><option key={p}>{p}</option>)}</select></label></div><label>Votre message<textarea name="body" rows={4} maxLength={4000} required/></label><label>Pièce jointe<select value={mode} onChange={e=>setMode(e.target.value)}><option value="none">Sans pièce jointe</option><option value="file">Choisir un fichier</option>{attachments.length>0&&<option value="existing">Document déjà dans mon dossier</option>}</select></label>{mode==="file"&&<label className="upload"><span>PDF, JPEG ou PNG · 8 Mo maximum</span><input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" required/></label>}{mode==="existing"&&<label>Document du dossier<select name="attachmentId" required defaultValue=""><option value="">Choisir</option>{attachments.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label>}</fieldset><Feedback error={error}/>{success&&<p className="feedback success" role="status">{success}</p>}<Submit pending={pending}>Envoyer</Submit></form>;
}
