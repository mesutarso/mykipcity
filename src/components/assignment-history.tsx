import { db } from "@/lib/db";
import { financeCase } from "@/lib/finance";
export async function AssignmentHistory({ caseId, userId }: { caseId: string; userId: string }) {
  await financeCase(userId, caseId);
  const events = await db.auditEvent.findMany({ where: { objectId: caseId, action: "FINANCE_CASE_REASSIGNED" }, orderBy: { createdAt: "desc" }, take: 50 });
  if (!events.length) return null;
  return <><h2>Changements de référent</h2>{events.map(event => { const detail = JSON.parse(event.detail); return <article className="review-card" key={event.id}><p>{detail.previousName} → {detail.targetName}</p><p>{detail.reason}</p><time dateTime={event.createdAt.toISOString()}>{event.createdAt.toLocaleString("fr-FR", { timeZone: "Africa/Kinshasa" })}</time></article>; })}</>;
}
