"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ShellNavigation({items,onNavigate}:{items:{href:string;label:string}[];onNavigate?:()=>void}){
  const pathname=usePathname();
  // Prefer the most specific entry, so Finance sub-sections don't activate Dossiers.
  const current=items.filter(item=>pathname===item.href||pathname.startsWith(`${item.href}/`))
    .sort((a,b)=>b.href.length-a.href.length)[0]?.href;
  const memberHome=pathname==="/mon-dossier"||pathname==="/mykipcity/profil";
  return <nav aria-label="Navigation principale">{items.map(item=><Link
    key={item.href} href={item.href} onClick={onNavigate}
    aria-current={item.href===current||(memberHome&&item.href==="/mykipcity")?"page":undefined}
  >{item.label}</Link>)}</nav>;
}
