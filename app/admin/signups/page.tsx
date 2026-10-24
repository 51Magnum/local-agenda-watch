import Link from "next/link";
import type {Metadata} from "next";
import {headers} from "next/headers";
import {authorizedReviewer} from "@/lib/timeline/auth";
import {listCoverageRequests} from "@/lib/areas/requests";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Signups & coverage requests",robots:{index:false,follow:false}};
export default async function Signups({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 if(!authorizedReviewer((await headers()).get("authorization")))return <main className="p-8">Admin access requires the configured password.</main>;
 const query=await searchParams,kind=query.kind==="follow"||query.kind==="coverage"?query.kind:undefined;
 const page=Math.max(1,Math.min(100000,parseInt(query.page??"1",10)||1));
 let data;
 try{data=await listCoverageRequests({kind,page});}catch{return <main className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Signup storage unavailable</h1><p className="mt-3">Check the database connection and try again. Submitted contact details are not included in error logs.</p></main>;}
 const link=(page:number,filter=kind)=>"/admin/signups?"+new URLSearchParams({...filter?{kind:filter}:{},page:String(page)});
 const date=(value:string)=>new Intl.DateTimeFormat("en-US",{timeZone:"America/Denver",dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
 return <main className="mx-auto w-full max-w-6xl flex-1 space-y-7 px-6 py-10">
  <header className="space-y-3"><h1 className="text-3xl font-semibold">Signups &amp; coverage requests</h1><p className="text-sm text-zinc-500">Newest submissions first. These are expressions of interest; alerts are not active and no notifications have been sent. Location details and emails are private.</p><Link href="/admin/review" className="text-sm underline">Case evidence review →</Link></header>
  <nav aria-label="Signup filters" className="flex flex-wrap gap-3 text-sm">{[{label:"All",count:data.counts.all,value:undefined},{label:"Alert interest",count:data.counts.follow,value:"follow" as const},{label:"Coverage requests",count:data.counts.coverage,value:"coverage" as const}].map(filter=><Link key={filter.label} href={filter.value?link(1,filter.value):"/admin/signups"} aria-current={kind===filter.value?"page":undefined} className="rounded-full border border-zinc-300 px-4 py-2 aria-[current=page]:bg-teal-100 aria-[current=page]:text-teal-950 dark:border-zinc-700">{filter.label} · {filter.count}</Link>)}</nav>
  {!data.total&&<p>No submissions yet.</p>}
  {!!data.items.length&&<div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800"><table className="w-full min-w-[850px] text-left text-sm"><caption className="sr-only">Private signup details, newest first</caption><thead className="bg-zinc-100 dark:bg-zinc-900"><tr>{["Received (America/Denver)","Type","Area / location","Interests","Email"].map(label=><th key={label} scope="col" className="p-4 font-semibold">{label}</th>)}</tr></thead><tbody>{data.items.map((item,i)=><tr key={item.id??item.createdAt+i} className="border-t border-zinc-200 align-top dark:border-zinc-800"><td className="p-4 whitespace-nowrap">{date(item.createdAt)}</td><td className="p-4">{item.kind==="follow"?"Alert interest":"Coverage request"}</td><td className="p-4"><p className="font-semibold">{item.areaRequested}</p>{item.address&&<p className="mt-2 whitespace-pre-wrap break-words">{item.address}</p>}{item.location&&<p className="mt-2 text-xs text-zinc-500">Selected point: {item.location.lat.toFixed(5)}, {item.location.lng.toFixed(5)}</p>}</td><td className="max-w-sm p-4 whitespace-pre-wrap break-words">{item.interests||"Not specified"}</td><td className="p-4 break-all">{item.email||"Not provided"}</td></tr>)}</tbody></table></div>}
  <nav aria-label="Signup pages" className="flex items-center gap-5 text-sm">{page>1&&<Link href={link(page-1)} className="underline">← Newer</Link>}<span>Page {page} · {data.total} {kind?"matching ":""}submissions</span>{page*data.pageSize<data.total&&<Link href={link(page+1)} className="underline">Older →</Link>}</nav>
 </main>;
}
