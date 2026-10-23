import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import CaseMap from "@/app/components/maps/case-map";
import { getJurisdiction } from "@/lib/maps/jurisdictions";
import { SITE_ORIGIN } from "@/lib/site-config";
type Props = { params: Promise<{ jurisdiction: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { const { jurisdiction } = await params; const config = getJurisdiction(jurisdiction); if (!config) notFound(); return { title: config.name + " development & future land use map", description: "Explore planning cases, upcoming hearings, and future land use in " + config.name + ". Search an address to see nearby cases.", alternates: { canonical: SITE_ORIGIN + "/" + jurisdiction + (config.mapOnHub ? "" : "/map") } }; }
export default async function MapPage({ params, searchParams }: Props) { const { jurisdiction } = await params; const config = getJurisdiction(jurisdiction); if (!config) notFound();
  if (config.mapOnHub) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams ?? {})) for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry);
    permanentRedirect("/" + jurisdiction + (query.size ? "?" + query : ""));
  }
  return <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-4"><header className="flex items-center justify-between gap-4"><h1 className="text-xl font-semibold">{config.name} development map</h1><Link href={"/" + jurisdiction} className="text-sm underline">All cases</Link></header><CaseMap jurisdiction={jurisdiction} fullPage/></main>; }
