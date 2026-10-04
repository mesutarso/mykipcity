import Image from "next/image";
import type { AttachmentView } from "@/lib/publication-attachments";
import { PublicationAttachmentRemove } from "./publication-attachment-form";
export function PublicationGallery({files,editableVersion}:{files:AttachmentView[];editableVersion?:number}){
 return <div className="publication-gallery">{files.map(file=><figure key={file.id} className="publication-attachment">{file.mimeType.startsWith("image/")&&<Image unoptimized src={`/api/publication-attachments/${file.id}`} width={1000} height={700} alt={file.caption} className="publication-photo"/>}<figcaption><h3>{file.caption}</h3>{file.mimeType.startsWith("image/")&&<p className="small muted">{file.takenOn?`Prise de vue : ${file.takenOn.split("-").reverse().join("/")}`:"Date de prise de vue non renseignée"}</p>}<a className="text-link" href={`/api/publication-attachments/${file.id}?download=1`}>{file.mimeType==="application/pdf"?"Télécharger le rapport":"Télécharger la photo"} · {Math.ceil(file.size/1024)} Ko</a></figcaption>{editableVersion!==undefined&&<PublicationAttachmentRemove key={`${file.id}-${editableVersion}`} id={file.id} version={editableVersion}/>}</figure>)}</div>;
}
