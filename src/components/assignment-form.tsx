"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function AssignmentForm({ kind, id, ownerId, version, referents }: { kind: "case" | "institution"; id: string; ownerId: string; version: number; referents: { id: string; name: string; email: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState(""), [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
    setPending(true); setError("");
    try {
      const res = await fetch("/api/equipe/reassign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, ownerId, version, targetId: data.get("targetId"), reason: data.get("reason") }) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error ?? "Réattribution impossible.");
      form.reset(); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Réattribution impossible."); } finally { setPending(false); }
  }
  const choices = referents.filter(r => r.id !== ownerId);
  if (!choices.length) return <p className="muted">Aucun autre référent Finance actif. Invitez ou réactivez un collaborateur depuis « Équipe et accès ».</p>;
  return <details className="offer-details"><summary>Changer de référent</summary><form className="form-stack" onSubmit={submit}><fieldset disabled={pending}><div className="form-grid"><label className="wide">Nouveau référent<select name="targetId" required defaultValue=""><option value="">Choisir un référent</option>{choices.map(r => <option value={r.id} key={r.id}>{r.name} · {r.email}</option>)}</select></label><label className="wide">Motif<textarea name="reason" required minLength={5} maxLength={500}/></label></div></fieldset>{error && <p className="feedback error" role="alert">{error}</p>}<button className="button" disabled={pending}>{pending ? "Réattribution…" : "Confirmer la réattribution"}</button></form></details>;
}
