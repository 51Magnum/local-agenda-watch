import {routeArea,areaMetadata,type AreaParams} from "@/lib/areas/server";
import {meetingsList} from "@/lib/meetings-list";
import MeetingList from "@/app/components/meeting-list";
export const revalidate=86400;
export const dynamic="force-dynamic";
export function generateStaticParams(){return [];}
export async function generateMetadata({params}:{params:Promise<AreaParams>}){return areaMetadata(await routeArea(await params),"/meetings");}
export default async function Page({params,searchParams}:{params:Promise<AreaParams>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const area=await routeArea(await params),query=await searchParams;
 const currentYear=Number(new Intl.DateTimeFormat("en-US",{year:"numeric",timeZone:area.timezone}).format(new Date()));
 const candidate=Number(query.year??currentYear),year=Number.isInteger(candidate)&&candidate>=2023&&candidate<=currentYear?candidate:currentYear;
 const data=await meetingsList(area.id,year);
 const filters={year,caseId:typeof query.case==="string"?query.case.toUpperCase():undefined,body:typeof query.body==="string"?query.body:undefined};
 return <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-8"><h1 className="text-3xl font-semibold">{area.name} meetings, agendas &amp; results</h1><p>Read official minutes for decisions and votes. A scheduled hearing does not establish an outcome.</p><a className="underline" href={area.residentAccess?.archiveUrl??area.sources.agendas}>Official meeting portal →</a><MeetingList initial={data} area={{id:area.id,name:area.name,timezone:area.timezone}} year={currentYear} filters={filters}/></main>;
}
