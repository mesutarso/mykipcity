import { staffInvitationInfo } from "@/lib/team";
import { Brand } from "@/components/shell";
import { StaffActivation } from "@/components/team-forms";
export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const invite = await staffInvitationInfo(token);
  return <main id="main-content" className="standalone"><Brand/><section className="panel invitation-panel"><p className="eyebrow">ÉQUIPE KIP-CITY</p><h1>{invite ? `Bienvenue, ${invite.name}` : "Ce lien n’est plus disponible."}</h1>{invite ? <StaffActivation token={token} email={invite.email} role={invite.role}/> : <><p>Demandez un nouveau lien à votre administrateur ou connectez-vous si votre compte est déjà créé.</p><a href="/connexion" className="button">Se connecter</a></>}</section></main>;
}
