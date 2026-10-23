import{routeArea,AREA_ADAPTERS,type AreaParams}from"@/lib/areas/server";import{notFound}from"next/navigation";
type Props={params:Promise<AreaParams&{planNumber:string}>};export async function generateMetadata({params}:Props){const p=await params,a=routeArea(p);if(a.status!=="live")notFound();return AREA_ADAPTERS[a.id].caseMetadata({params:Promise.resolve({planNumber:p.planNumber})});}
export default async function Page({params}:Props){const p=await params,a=routeArea(p);if(a.status!=="live")notFound();return AREA_ADAPTERS[a.id].case({params:Promise.resolve({planNumber:p.planNumber})});}
