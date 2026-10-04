"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { staffRoles } from "@/lib/roles";
type Role = keyof typeof staffRoles;
async function post(action: string, input: unknown) {
  const res = await fetch(`/api/equipe/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error ?? "Enregistrement impossible.");
  return result;
}
function RoleSelect({ value }: { value?: string }) { return <label>Rôle<select name="role" defaultValue={value ?? "ACQUIRER_AGENT"}>{Object.entries(staffRoles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>; }
export function TeamForm({ member }: { member?: { id: string; role: string; active: boolean; accessVersion: number } }) {
  const router = useRouter();
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [url, setUrl] = useState(""), [saved, setSaved] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); setPending(true); setError(""); setUrl(""); setSaved(false);
    try {
      const result = await post(member ? "update" : "invite", member ? { id: member.id, version: member.accessVersion, role: data.role, active: data.active === "true", reason: data.reason } : data);
      if (result.url) { setUrl(result.url); form.reset(); }
      setSaved(true); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setPending(false); }
  }
  return <form className="form-stack" onSubmit={submit}><fieldset disabled={pending}><div className="form-grid">{!member && <><label>Nom complet<input name="name" required minLength={2} maxLength={120}/></label><label>E-mail<input name="email" type="email" required maxLength={160}/></label></>}<RoleSelect value={member?.role}/>{member && <><label>Accès<select name="active" defaultValue={String(member.active)}><option value="true">Actif</option><option value="false">Suspendu</option></select></label><label className="wide">Motif du changement<textarea name="reason" required minLength={5} maxLength={500}/></label></>}</div></fieldset>{error && <p className="feedback error" role="alert">{error}</p>}{saved && !url && <p role="status" className="feedback">Accès mis à jour.</p>}{url && <InvitationLink url={url}/>}<button className="button" disabled={pending}>{pending ? "Enregistrement…" : member ? "Enregistrer les accès" : "Créer l’invitation"}</button></form>;
}
function InvitationLink({ url }: { url: string }) { return <div className="notice" role="status"><label>Lien d’invitation<input readOnly value={url} onFocus={e => e.target.select()}/></label><p>Valable 48 heures. Aucun e-mail n’a été envoyé.</p></div>; }
export function InvitationActions({ id, version, revoked }: { id: string; version: number; revoked: boolean }) {
  const router = useRouter(); const [url, setUrl] = useState(""), [error, setError] = useState(""), [pending, setPending] = useState(false);
  async function run(action: "renew" | "revoke") { setPending(true); setError(""); setUrl(""); try { const result = await post("invitation", { id, version, action }); setUrl(result.url ?? ""); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setPending(false); } }
  return <div className="form-stack"><div className="actions"><button className="button secondary" disabled={pending} onClick={() => run("renew")}>Renouveler le lien</button>{!revoked && <button className="button secondary" disabled={pending} onClick={() => run("revoke")}>Révoquer</button>}</div>{url && <InvitationLink url={url}/>}<p role="alert">{error}</p></div>;
}
export function StaffActivation({ token, email, role }: { token: string; email: string; role: string }) {
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = new FormData(e.currentTarget); setPending(true); setError(""); if (form.get("password") !== form.get("confirm")) { setError("Les mots de passe ne correspondent pas."); setPending(false); return; } try { await post("activate", { token, password: form.get("password"), accepted: form.get("accepted") === "on" }); setDone(true); } catch (e) { setError(e instanceof Error ? e.message : "Activation impossible."); } finally { setPending(false); } }
  if (done) return <div role="status"><p>Votre compte est créé.</p><a className="button" href="/connexion">Se connecter</a></div>;
  return <form onSubmit={submit} className="form-stack"><p>{email} · {staffRoles[role as Role]}</p><label>Mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/><small>12 caractères minimum.</small></label><label>Confirmer le mot de passe<input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label><label className="check-label"><input type="checkbox" name="accepted" required/>J’accepte les <a href="/conditions">conditions d’accès</a>.</label>{error && <p className="feedback error" role="alert">{error}</p>}<button className="button" disabled={pending}>{pending ? "Création…" : "Créer mon compte"}</button></form>;
}
