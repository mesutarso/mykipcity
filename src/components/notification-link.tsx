import Link from "next/link";
import { sessionActor } from "@/lib/session";
import { notifications } from "@/lib/notifications";
export async function NotificationLink(){const actor=await sessionActor(true);const count=(actor.role!=="ACQUIRER"&&!actor.twoFactorEnabled&&process.env.REQUIRE_STAFF_MFA!=="false"?[]:await notifications(actor.id)).filter(n=>!n.read).length;return <Link href="/notifications" className="text-link" aria-label={`Notifications, ${count} non lues`}>Notifications{count>0&&<span className="notification-count">{count}</span>}</Link>;}
