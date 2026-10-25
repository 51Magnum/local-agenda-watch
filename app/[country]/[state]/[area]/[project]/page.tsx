import {projectDetail} from "@/lib/maps/project-detail";
import {projects} from "@/lib/projects";
import ProjectPage from "@/app/components/maps/project-page";
import{routeArea,AREA_ADAPTERS,areaMetadata,type AreaParams}from"@/lib/areas/server";import{areaPath}from"@/lib/areas/registry";import{notFound,permanentRedirect}from"next/navigation";
type Props={params:Promise<AreaParams&{project:string}>};export async function generateMetadata({params}:Props){const p=await params,a=routeArea(p);const project=projects.find(item=>item.slug===p.project&&(item.areaId??"nampa")===a.id),data=project?await projectDetail(a.id,project.caseIds[0]):null;return data?(await import("@/lib/project-seo")).projectMetadata(data):AREA_ADAPTERS[a.id]?.projectMetadata[p.project]??areaMetadata(a,"/"+p.project);}
export default async function Page({params}:Props){const p=await params,a=routeArea(p);if(p.project==="toll-brothers-amity-happy-valley")permanentRedirect(areaPath(a)+"/braeburn-creek");const render=AREA_ADAPTERS[a.id]?.projects[p.project];if(a.status!=="live"||!render)notFound();const project=Object.values(projects).find(item=>item.slug===p.project);const data=project?await projectDetail(a.id,project.caseIds[0]):null;return data?<ProjectPage data={data}/>:render();}

export const revalidate=86400;
export function generateStaticParams(){return [];}
