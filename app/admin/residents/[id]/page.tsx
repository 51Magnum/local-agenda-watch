import Link from "next/link";
import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {authorizedReviewer} from "@/lib/timeline/auth";
import {isPreview} from "@/lib/runtime-environment";
import {adminResidentDetail,recentPlanChanges,ResidentAdminError} from "@/lib/admin-residents";
import {adminResidentTime} from "@/lib/admin-resident-types";
import {PAID_PIN_LIMIT} from "@/lib/plan-policy";
import PlanChanges from "../changes";
export const dynamic="force-dynamic";
export const metadata={title:"Resident account",robots:{index:false,follow:false}};
export default async function ResidentAdminDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{changed?:string}>}){
 const authorization=(await headers()).get("authorization");if(!authorizedReviewer(authorization))return <main>Admin access required.</main>;
 if(isPreview())return <main>Not available in preview.</main>;
 const {id}=await params;let detail,changes;
 try{detail=await adminResidentDetail(authorization,id);changes=await recentPlanChanges(authorization,id);}catch(error){if(error instanceof ResidentAdminError&&error.status===404)notFound();return <main className="p-8">Resident account storage is unavailable. Please try again later.</main>;}
 const {resident,pins}=detail;
 return <main className="mx-auto max-w-4xl space-y-6 p-8"><Link className="underline" href="/admin/residents">All resident accounts</Link><h1 className="text-3xl font-semibold">Resident account</h1><p>{resident.email}</p>{(await searchParams).changed&&<p role="status">Plan change saved and recorded.</p>}<p>Plan: <strong>{resident.plan==="paid"?"Paid":"Free"}</strong> · {resident.activePins} active pins · {resident.inactivePins} inactive pins</p><p>Signed up: {adminResidentTime(resident.createdAt)}<br/>Last sign-in: {adminResidentTime(resident.lastSignInAt)}</p>
  <form className="space-y-3 rounded border p-5" action="/admin/residents/action" method="post"><h2 className="text-xl font-semibold">Change plan</h2><input type="hidden" name="action" value="review"/><input type="hidden" name="residentId" value={resident.id}/><label>New plan<select className="ml-3 rounded border p-2" name="plan" defaultValue={resident.plan==="free"?"paid":"free"}><option value="free">Free</option><option value="paid">Paid</option></select></label><p>Free keeps one active pin at 1 mile; extra pins become inactive and their alerts stop. Paid allows up to {PAID_PIN_LIMIT} active pins at 0.25–10 miles. Upgrading does not reactivate pins or restart emails.</p><button className="rounded border px-4 py-2">Review plan change</button></form>
  <section className="space-y-3"><h2 className="text-2xl font-semibold">Pins</h2>{!pins.length?<p>No saved pins.</p>:<div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Label</th><th>Radius</th><th>Status</th><th>Alerts</th></tr></thead><tbody>{pins.map(p=><tr key={p.id}><td className="py-3 pr-4">{p.label}</td><td>{p.radiusMiles} {p.radiusMiles===1?"mile":"miles"}</td><td>{p.active?"Active":"Inactive"}</td><td>{p.alertsEnabled?"On":"Off"}</td></tr>)}</tbody></table></div>}</section><PlanChanges changes={changes}/>
 </main>;
}
