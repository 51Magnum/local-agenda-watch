import Link from "next/link";
import {headers} from "next/headers";
import {authorizedReviewer} from "@/lib/timeline/auth";
import {isPreview} from "@/lib/runtime-environment";
import {searchResidents,recentPlanChanges} from "@/lib/admin-residents";
import ResidentSearch from "./search-form";
import PlanChanges from "./changes";
export const dynamic="force-dynamic";
export const metadata={title:"Resident accounts",robots:{index:false,follow:false}};
export default async function ResidentsAdmin(){
 const authorization=(await headers()).get("authorization");
 if(!authorizedReviewer(authorization))return <main>Admin access required.</main>;
 if(isPreview())return <main>Not available in preview.</main>;
 let initial,changes;
 try{
  initial=await searchResidents(authorization,"");changes=await recentPlanChanges(authorization);
 }catch{return <main className="p-8">Resident account storage is unavailable. Please try again later.</main>;}
 return <main className="mx-auto max-w-7xl space-y-7 p-8"><Link className="underline" href="/admin">Admin overview</Link><h1 className="text-3xl font-semibold">Resident accounts</h1><p>Find an account, review its pins, and confirm any plan change. No payment flow is enabled.</p><ResidentSearch initial={initial}/><PlanChanges changes={changes}/></main>;
}
