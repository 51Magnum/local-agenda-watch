import {projectDetail} from "@/lib/maps/project-detail";
import ProjectPage from "@/app/components/maps/project-page";
import{routeArea,AREA_ADAPTERS,type AreaParams}from"@/lib/areas/server";import{notFound}from"next/navigation";
type Props={params:Promise<AreaParams&{planNumber:string}>};export async function generateMetadata({params}:Props){const p=await params,a=await routeArea(p);if(a.status!=="live")notFound();const data=await projectDetail(a.id,p.planNumber.toUpperCase());return data?(await import("@/lib/project-seo")).projectMetadata(data):AREA_ADAPTERS[a.id].caseMetadata({params:Promise.resolve({planNumber:p.planNumber})});}
export default async function Page({params}:Props){const p=await params,a=await routeArea(p);if(a.status!=="live")notFound();const data=await projectDetail(a.id,p.planNumber.toUpperCase());return data?<ProjectPage data={data}/>:AREA_ADAPTERS[a.id].case({params:Promise.resolve({planNumber:p.planNumber})});}

export const revalidate=86400;
export function generateStaticParams(){return [];}
