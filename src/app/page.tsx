import { homeForRole } from "@/lib/roles";
import { redirect } from "next/navigation";
import { pageActor } from "@/lib/session";
export default async function Home(){const actor=await pageActor();redirect(homeForRole(actor.role));}
