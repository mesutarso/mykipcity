export const importHeaders={ACQUIRERS:["reference","nom","email"],PARCELS:["reference","superficie","reference_cadastrale"]} as const;
export type ImportKind=keyof typeof importHeaders;
export type ImportRow={line:number;values:string[];state:"CREATE"|"EXISTS"|"ERROR";message:string;warnings:string[];existingId?:string};
export const importStates={CREATE:"À créer",EXISTS:"Déjà présent",ERROR:"À corriger"};
// Strict RFC-style quoted fields; accepts the two common French CSV separators.
export function parseRegistryCsv(source:string,kind:ImportKind):string[][]{
 const text=source.replace(/^\uFEFF/,"");if(text.includes("\uFFFD")||text.includes("\0"))throw new Error("Enregistrez le fichier CSV en UTF-8.");
 const delimiter=text.split(/\r?\n/,1)[0].includes(";")?";":",";
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false,closed=false;
 function field(){row.push(cell.trim());cell="";closed=false;}
 function record(){field();if(row.some(v=>v!==""))rows.push(row);row=[];if(rows.length>501)throw new Error("Import limité à 500 lignes de données.");}
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch===delimiter){field();continue;}
  if(ch==="\n"||ch==="\r"){if(ch==="\r"&&text[i+1]==="\n")i++;record();continue;}
  if(ch==='"'){if(cell||closed)throw new Error("Guillemets mal placés dans le CSV.");quoted=true;continue;}
  if(closed){if(ch===" "||ch==="\t")continue;throw new Error("Caractère inattendu après un champ entre guillemets.");}
  cell+=ch;
 }
 if(quoted)throw new Error("Un champ entre guillemets n’est pas fermé.");if(cell||closed||row.length)record();
 const header=rows.shift();if(!header||header.join("|").toLowerCase()!==importHeaders[kind].join("|"))throw new Error(`Colonnes attendues : ${importHeaders[kind].join(" ; ")}.`);
 if(!rows.length)throw new Error("Le fichier ne contient aucune ligne de données.");return rows;
}
