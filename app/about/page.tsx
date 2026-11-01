import {visibleAreas} from "@/lib/areas/registry";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE_ORIGIN } from "@/lib/site-config";
export const dynamic="force-dynamic";
export const metadata: Metadata = { title: "About", alternates: { canonical: SITE_ORIGIN + "/about" } };
export default async function About() {
  const areas=await visibleAreas();
  return <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-14">
    <h1 className="text-3xl font-semibold">About Local Agenda Watch</h1>
    <p className="leading-8">Local Agenda Watch is an independent, nonpartisan public-information project. It connects local land-use proposals with their locations, case records, public hearings and participation instructions.</p>
    <p className="leading-8">We are not affiliated with any of these governments, any developer or a political party. We describe proposals and decisions without advocating for an outcome.</p>
    <p className="leading-8">Our pages combine official city records with clearly labeled project background. Source systems can disagree or be temporarily unavailable; consult the linked official records for current deadlines and decisions.</p>
    <section><h2 className="text-xl font-semibold">Covered areas</h2><ul className="mt-3 space-y-2">{areas.filter(a=>a.status==="live").map(a=><li key={a.id}>{a.name}, {a.stateAbbreviation}</li>)}</ul></section>
    <p><Link href="/contact" className="underline underline-offset-4">Contact and corrections</Link></p>
  </main>;
}
