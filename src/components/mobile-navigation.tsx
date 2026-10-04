"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ShellNavigation } from "./shell-navigation";
import { Logout } from "./forms";

export function MobileNavigation({items,title,name,member,brand,notifications}:{
  items:{href:string;label:string}[];title:string;name:string;member:boolean;brand:ReactNode;notifications:ReactNode;
}) {
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    const desktop=window.matchMedia("(min-width: 761px)");
    const closeOnDesktop=()=>{if(desktop.matches)setOpen(false);};
    desktop.addEventListener("change",closeOnDesktop);
    return ()=>desktop.removeEventListener("change",closeOnDesktop);
  },[]);
  return <div className="mobile-navigation">
    {brand}
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button variant="outline" size="lg" aria-label="Ouvrir le menu"><Menu data-icon="inline-start"/>Menu</Button></SheetTrigger>
      <SheetContent side="left" className="mobile-menu-panel">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{name}</SheetDescription>
        </SheetHeader>
        <div className="mobile-menu-scroll">
          <ShellNavigation items={items} onNavigate={()=>setOpen(false)}/>
          <nav className="mobile-account-nav" aria-label="Votre compte" onClick={event=>{if((event.target as HTMLElement).closest("a"))setOpen(false);}}>
            {notifications}
            {member&&<Link href="/mykipcity/profil">Mon profil</Link>}
            <Link href="/compte">Sécurité du compte</Link>
          </nav>
          <div className="mobile-menu-footer">
            <a href="https://kip-city.com" target="_blank" rel="noreferrer">Site public ↗</a>
            <Logout/>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>;
}
