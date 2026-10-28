import {headers} from "next/headers";
import Link from "next/link";
import {notFound} from "next/navigation";
import {authorizedReviewer} from "@/lib/timeline/auth";
import {privateProject} from "@/lib/jurisdictions/preview";
import PreviewProject from "../../../project-view";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{area:string;caseId:string}>}){if(!authorizedReviewer((await headers()).get("authorization")))notFound();const p=await params,data=await privateProject(p.area,p.caseId);if(!data)notFound();return <main className="mx-auto max-w-4xl p-6"><Link href="/admin/jurisdictions" className="underline">Jurisdiction review</Link><p className="my-4 rounded bg-amber-50 p-3 text-amber-950">Not public · As of {data.updatedAt}</p><PreviewProject data={data}/></main>;}
