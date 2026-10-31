import{routeArea,AREA_ADAPTERS,type AreaParams}from"@/lib/areas/server";export async function GET(_request:Request,{params}:{params:Promise<AreaParams&{project:string}>}){const p=await params,a=await routeArea(p);if(a.status!=="live"||!AREA_ADAPTERS[a.id]?.projects[p.project])return new Response("Not found",{status:404});return AREA_ADAPTERS[a.id].projectCalendar();}

