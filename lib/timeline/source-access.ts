import { getArea } from "@/lib/areas/registry";
import { hostWasBlocked, recordHost } from "./telemetry";
export class BlockedSourceError extends Error { constructor(public host:string){super("Official source blocked: "+host);this.name="BlockedSourceError";} }
export const isBlockedSource=(error:unknown)=>error instanceof BlockedSourceError||(!/Extraction API/.test(error instanceof Error?error.message:String(error))&&/HTTP (?:401|403|429)|Cloudflare|challenge page|official source blocked/i.test(error instanceof Error?error.message:String(error)));
export function allowedSource(value:string,areaId="nampa"){
 try{const u=new URL(value),config=getArea(areaId)?.timeline;return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&Boolean(config&&(config.hosts.includes(u.hostname)||config.storage?.some(s=>s.host===u.hostname&&u.pathname.startsWith(s.pathPrefix))));}catch{return false;}
}
export async function sourceRequest(url:string,areaId:string,accept="text/html,application/json,application/pdf",timeout=12000){
 if(!allowedSource(url,areaId))throw new Error("Source is outside the jurisdiction allowlist");
 if(hostWasBlocked(areaId,url))throw new BlockedSourceError(new URL(url).hostname);
 let target=url;
 try{
 for(let i=0;i<5;i++){
  const r=await fetch(target,{redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(timeout),headers:{Accept:accept,"User-Agent":"Mozilla/5.0 (compatible; LocalAgendaWatch public records reader)"}});
  if([301,302,303,307,308].includes(r.status)){
   const location=r.headers.get("location");if(!location)throw new Error("Source redirect missing location");
   target=new URL(location,target).href;if(!allowedSource(target,areaId))throw new Error("Source redirect is outside the jurisdiction allowlist");continue;
  }
  if([401,403,429].includes(r.status)){await r.body?.cancel();throw new BlockedSourceError(new URL(target).hostname);}
  if(!r.ok)throw new Error("Official source HTTP "+r.status);
  if(/text\/html/i.test(r.headers.get("content-type")??"")){
   const text=await r.clone().text();
   if(/cf-chl-|Just a moment|Attention Required.*Cloudflare|challenge-platform/i.test(text))throw new BlockedSourceError(new URL(target).hostname);
  }
  recordHost(areaId,target,"worked");return r;
 }
 throw new Error("Too many source redirects");
 }catch(error){recordHost(areaId,target,isBlockedSource(error)?"blocked":"unavailable",isBlockedSource(error)?"Access challenge or HTTP 401/403/429":"Request failed");throw error;}
}
