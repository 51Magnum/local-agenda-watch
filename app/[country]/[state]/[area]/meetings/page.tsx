import {Suspense} from "react";
import {routeArea,areaMetadata,type AreaParams} from "@/lib/areas/server";
import {meetingsList} from "@/lib/meetings-list";
import MeetingList from "@/app/components/meeting-list";
export const revalidate=86400;
export function generateStaticParams(){return [];}
export async function generateMetadata({params}:{params:Promise<AreaParams>}){return areaMetadata(routeArea(await params),"/meetings");}
export default async function Page({params}:{params:Promise<AreaParams>}){const area=routeArea(await params),year=Number(new Intl.DateTimeFormat("en-US",{year:"numeric",timeZone:area.timezone}).format(new Date())),data=await meetingsList(area.id,year);return <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-8"><h1 className="text-3xl font-semibold">{area.name} meetings, agendas &amp; results</h1><p>Read official minutes for decisions and votes. A scheduled hearing does not establish an outcome.</p><a className="underline" href={area.residentAccess?.archiveUrl??area.sources.agendas}>Official meeting portal →</a><Suspense fallback={<p>Loading meeting filters…</p>}><MeetingList initial={data} area={{id:area.id,name:area.name,timezone:area.timezone}} year={year}/></Suspense></main>;}
