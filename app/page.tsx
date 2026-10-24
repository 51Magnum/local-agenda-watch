import type{Metadata}from"next";
import LocationHome from"./components/locations/location-home";
import{AREAS,publicArea}from"@/lib/areas/registry";
import{getLocality,getTrackedCaseCount}from"@/lib/localities";
import{homeAreaData,type HomeAreaData}from"@/lib/areas/home-data";
import{SITE_ORIGIN}from"@/lib/site-config";
export const revalidate=3600;
export const metadata:Metadata={title:{absolute:"Local Agenda Watch | Rezoning, Annexation & Public Hearing Tracker"},description:"Find development proposals, rezoning requests and public hearings near you, with links to official records.",alternates:{canonical:SITE_ORIGIN+"/"},openGraph:{title:"What's being built near you? | Local Agenda Watch",description:"Explore development proposals, public hearings and decisions using official local records.",url:SITE_ORIGIN,images:[SITE_ORIGIN+"/opengraph-image"]}};
export default async function Home(){
  const rows=await Promise.all(Object.values(AREAS).filter(a=>a.status==="live").map(async area=>{try{const locality=getLocality(area.id),feed=await locality?.getHearings?.();return locality&&feed?{count:getTrackedCaseCount(locality,feed),data:homeAreaData(area,feed)}:null;}catch{console.error("[home] Area feed unavailable",area.id);return null;}}));
  const data:HomeAreaData[]=rows.flatMap(row=>row?[row.data]:[]);
  const count=rows.some(row=>!row)?null:rows.reduce((sum,row)=>sum+(row?.count??0),0);
  return <LocationHome areas={Object.values(AREAS).map(publicArea)} data={data} caseCount={count}/>;
}
