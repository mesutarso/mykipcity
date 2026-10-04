import type { Metadata } from "next";
import "./globals.css";
import "./workspace-theme.css";
export const metadata:Metadata={title:{default:"MyKipCity · Espace privé",template:"%s · MyKipCity"},description:"Espace privé des acquéreurs et des équipes Kip-City.",robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fr"><body><a className="skip" href="#main-content">Aller au contenu</a>{children}</body></html>;}
