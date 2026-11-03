import Link from "next/link";
import {adminResidentTime,type AdminPlanChange} from "@/lib/admin-resident-types";
export default function PlanChanges({changes}:{changes:AdminPlanChange[]}){
 return <section className="space-y-3"><h2 className="text-2xl font-semibold">Recent plan changes</h2>{!changes.length?<p>No plan changes recorded.</p>:<ul className="space-y-3">{changes.map(c=><li key={c.id} className="rounded border p-3">{c.residentId?<Link className="underline" href={"/admin/residents/"+c.residentId}>{c.email??"Removed account"}</Link>:"Removed account"} · {c.oldPlan==="paid"?"Paid":"Free"} → {c.newPlan==="paid"?"Paid":"Free"}<br/>{c.action} by {c.actor} · {adminResidentTime(c.createdAt)}</li>)}</ul>}</section>;
}
