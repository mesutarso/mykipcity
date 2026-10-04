"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="standalone" id="main-content"><section className="panel"><h1>La page n’a pas pu être chargée</h1><p className="profile-help">Réessayez dans un instant. Si vous veniez d’envoyer un formulaire, vérifiez son état avant de le renvoyer.</p><div className="actions"><button className="button" onClick={reset}>Réessayer</button><Link href="/" className="text-link">Revenir à mon espace</Link></div></section></main>;}
