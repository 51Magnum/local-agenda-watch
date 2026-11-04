import Link from "next/link";
import {ADMIN_SECTIONS} from "@/lib/admin-navigation";
import {adminAttention} from "@/lib/admin-attention";
export default async function AdminOverviewCards(){
 const counts=await adminAttention(),count=(n:number|null,label:string)=>n===null?label+": count unavailable":`${n} ${label}`;
 return <section aria-label="Admin sections" className="law-admin-cards">{ADMIN_SECTIONS.map(section=><article key={section.id}><h2>{section.label}</h2><p>{section.description}</p>{section.id==="content"&&<p>{count(counts.evidence,"pending evidence fields")}</p>}{section.id==="jurisdictions"&&<p>{count(counts.exceptions,"queued record exceptions")}</p>}{section.id==="images"&&<p>{count(counts.images,"flagged or withheld images")}</p>}{section.id==="corrections"&&<p>{count(counts.corrections,"pending corrections")}</p>}{section.links.map(link=><Link prefetch={false} key={link.href} href={link.href}>{link.label}</Link>)}</article>)}</section>;
}
