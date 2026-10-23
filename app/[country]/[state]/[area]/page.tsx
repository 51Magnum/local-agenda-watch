import{routeArea,AREA_ADAPTERS,areaMetadata,type AreaParams}from"@/lib/areas/server";import ComingSoon from"@/app/components/locations/coming-soon";
export async function generateMetadata({params}:{params:Promise<AreaParams>}){return areaMetadata(routeArea(await params));}
export default async function Page({params,searchParams}:{params:Promise<AreaParams>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const a=routeArea(await params);if(a.status!=="live")return <ComingSoon area={a}/>;return AREA_ADAPTERS[a.id].hub({searchParams});}
