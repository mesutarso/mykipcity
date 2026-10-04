import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { getActor, WorkflowError } from "./workflow";
export async function sessionActor(allowMfaSetup=false) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new WorkflowError("Connectez-vous pour continuer.", 401);
  const actor=await getActor(session.user.id);
  if(!allowMfaSetup&&actor.role!=="ACQUIRER"&&process.env.REQUIRE_STAFF_MFA!=="false"&&!actor.twoFactorEnabled)throw new WorkflowError("Configurez la double authentification dans Sécurité pour accéder à votre espace interne.",428);
  return actor;
}
export async function pageActor(allowMfaSetup=false) {
  try { return await sessionActor(allowMfaSetup); }
  catch(error) { if(error instanceof WorkflowError&&error.status===428)redirect("/compte");redirect("/connexion"); }
}
