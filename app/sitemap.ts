import {visibleAreas} from "@/lib/areas/registry";
import{areaPath}from"@/lib/areas/registry";
import{caseCatalog}from"@/lib/case-catalog";
import type{MetadataRoute}from"next";
import{getLocality}from"@/lib/localities";
import{projects,getProjectForCase}from"@/lib/projects";
import{SITE_ORIGIN}from"@/lib/site-config";
export const revalidate=3600;
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const urls=new Set(["/","/about","/contact","/privacy"]);
 for(const a of (await visibleAreas())){
  const base=areaPath(a);urls.add("/"+a.country);urls.add("/"+a.country+"/"+a.state);urls.add(base);
  if(a.status!=="live")continue;
  urls.add(base+"/map");urls.add(base+"/meetings");
  const feed=await getLocality(a.id)?.getHearings?.();
  for(const h of caseCatalog(feed)){
   const project=getProjectForCase(h.appId,a.id);
   urls.add(base+"/"+(project?.slug??"plan/"+encodeURIComponent(h.appId)));
  }
  for(const p of projects.filter(p=>(p.areaId??"nampa")===a.id))urls.add(base+"/"+p.slug);
 }
 // A sweep timestamp is not a record-change date. Omit lastmod until a real
 // content modification timestamp is available, rather than inventing one.
 return [...urls].map(path=>({url:SITE_ORIGIN+path}));
}
