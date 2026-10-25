import {headers} from "next/headers";
import {authorizedReviewer} from "@/lib/timeline/auth";
import SweepControl from "./sweep-control";
export const dynamic="force-dynamic";
export default async function SweepPage(){if(!authorizedReviewer((await headers()).get("authorization")))return <main>Admin access required.</main>;return <main className="mx-auto max-w-5xl space-y-5 p-8"><a className="underline" href="/admin">Source health</a><h1 className="text-3xl font-semibold">Run a forced source sweep</h1><p>Runs discovery and bounded extraction for every live area on this deployment. It bypasses the time window, keeps the existing run budget and approval rules, and records the per-area results.</p><SweepControl extractionConfigured={Boolean(process.env.OPENAI_API_KEY)}/></main>;}
