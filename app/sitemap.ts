import{AREAS,areaPath}from"@/lib/areas/registry";
import{caseCatalog}from"@/lib/case-catalog";
import type{MetadataRoute}from"next";
import{getLocality}from"@/lib/localities";
import{projects}from"@/lib/projects";
import{SITE_ORIGIN}from"@/lib/site-config";
export const revalidate=3600;
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const urls=new Set(["/","/about","/contact","/privacy"]);for(const a of Object.values(AREAS)){const base=areaPath(a);urls.add("/"+a.country);urls.add("/"+a.country+"/"+a.state);urls.add(base);if(a.status!=="live")continue;urls.add(base+"/map");urls.add(base+"/meetings");const locality=getLocality(a.id);const feed=await locality?.getHearings?.();for(const h of caseCatalog(feed))urls.add(base+"/plan/"+encodeURIComponent(h.appId));for(const p of projects.filter(p=>(p.areaId??"nampa")===a.id)){urls.add(base+"/"+p.slug);for(const id of p.caseIds)urls.add(base+"/plan/"+id);}}return [...urls].map(path=>({url:SITE_ORIGIN+path}));}
