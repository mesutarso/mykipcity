export type ContractPage={id:string;groupId:string|null;revision:number;page:number;isCurrent:boolean;originalName:string;size:number;details:unknown};
export function contractGroups<T extends ContractPage>(documents:T[]){
 const grouped=new Map<string,T[]>();for(const doc of documents){const key=doc.groupId??doc.id;grouped.set(key,[...(grouped.get(key)??[]),doc]);}
 return [...grouped].map(([id,pages])=>({id,versions:[...new Set(pages.map(p=>p.revision))].sort((a,b)=>b-a).map(revision=>({revision,pages:pages.filter(p=>p.revision===revision).sort((a,b)=>a.page-b.page)}))}));
}
