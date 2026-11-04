import {headers} from "next/headers";
import Link from "next/link";
import {authorizedReviewer} from "@/lib/timeline/auth";
import {getEvidenceStore} from "@/lib/timeline/store";
import {recentPlanChanges} from "@/lib/admin-residents";
import {adminResidentTime} from "@/lib/admin-resident-types";
export const dynamic="force-dynamic";
export default async function Audits(){
 const auth=(await headers()).get("authorization");if(!authorizedReviewer(auth))return <main>Admin access required.</main>;
 const results=await Promise.allSettled([getEvidenceStore().read(),recentPlanChanges(auth)]);
 return <main className="space-y-6 p-6"><h1 className="text-3xl font-semibold">Audit history</h1><p>Read recent evidence decisions and resident plan changes. Open the original review page for source details; this page makes no changes.</p><section><h2 className="text-xl font-semibold">Resident plan changes</h2>{results[1].status==="rejected"?<p>Plan audit storage unavailable.</p>:<ul>{results[1].value.map(c=><li key={c.id}>{adminResidentTime(c.createdAt)} · {c.actor} · {c.oldPlan} → {c.newPlan} {c.residentId&&<Link className="underline" href={"/admin/residents/"+c.residentId}>Account details</Link>}</li>)}</ul>}</section><section><h2 className="text-xl font-semibold">Evidence decisions</h2>{results[0].status==="rejected"?<p>Evidence audit storage unavailable.</p>:<ul>{results[0].value.audit.slice(-50).reverse().map((a,i)=><li key={i}>{adminResidentTime(a.at)} · {a.action} · Field {a.fieldId.slice(0,12)}</li>)}</ul>}<Link className="underline" href="/admin/review">Open evidence review and full history</Link></section></main>;
}
