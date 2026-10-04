import { applicationOrigins } from "./origins";
import { WorkflowError } from "./workflow";
import { ZodError } from "zod";
export function checkOrigin(request: Request) {
  if (!applicationOrigins().includes(request.headers.get("origin")??"")) {
    throw new WorkflowError("Origine de la demande non autorisée.", 403);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof WorkflowError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Vérifiez les champs." }, { status: 400 });
  console.error("workflow_error", error instanceof Error ? error.name : "unknown");
  return Response.json({ error: "L’opération n’a pas abouti. Rechargez puis réessayez." }, { status: 500 });
}
