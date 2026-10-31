import {withDbTransfer,currentDbTransfer} from "@/lib/db-transfer";
import{routeArea,AREA_ADAPTERS,areaMetadata,type AreaParams}from"@/lib/areas/server";import ComingSoon from"@/app/components/locations/coming-soon";
export async function generateMetadata({params}:{params:Promise<AreaParams>}){return areaMetadata(await routeArea(await params));}
export default async function Page({params,searchParams}:{params:Promise<AreaParams>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const a=await routeArea(await params);if(a.status!=="live")return <ComingSoon area={a}/>;return withDbTransfer(async()=>{const result=await AREA_ADAPTERS[a.id].hub({searchParams:Promise.resolve({})});console.info("[area:render]",JSON.stringify({area:a.id,...currentDbTransfer()}));return result;});}

export const revalidate=86400;
export function generateStaticParams(){return [];}
