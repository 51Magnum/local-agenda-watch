import { caseSpecificRecordUrl } from "../maps/project-records";
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { EmailProject } from "./project";
import { SITE_ORIGIN } from "../site-config";

export type LinkCheck={ok:boolean;url?:string;reason?:string};
export type LinkChecker=(url:string)=>Promise<LinkCheck>;
function publicAddress(address:string):boolean {
  if(isIP(address)===4) { const [a,b]=address.split(".").map(Number); return a!==0&&a!==10&&a!==127&&a<224&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&b===168)&&!(a===100&&b>=64&&b<=127); }
  const v=address.toLowerCase();return isIP(v)===6&&!v.startsWith("::")&&!/^f[cd]|^fe[89ab]/.test(v);
}
async function publicHost(host:string) {
  const addresses=await lookup(host.replace(/^\[|\]$/g,""),{all:true});
  return !!addresses.length&&addresses.every(a=>publicAddress(a.address));
}
/** Follow redirects with normal TLS verification and bounded, public HTTPS targets. */
export async function checkOfficialLink(value:string,fetcher:typeof fetch=fetch,hostCheck=publicHost):Promise<LinkCheck> {
  try {
    let url=new URL(value);
    for(let hop=0;hop<6;hop++) {
      if(url.protocol!=="https:"||url.username||url.password||!await hostCheck(url.hostname))return {ok:false,reason:"Unsafe or non-public HTTPS target"};
      const response=await fetcher(url.href,{method:"GET",redirect:"manual",signal:AbortSignal.timeout(5000)});
      await response.body?.cancel();
      if([301,302,303,307,308].includes(response.status)) { const location=response.headers.get("location");if(!location)return {ok:false,reason:"Redirect has no target"};url=new URL(location,url);continue; }
      return response.status===200?{ok:true,url:url.href}:{ok:false,reason:"HTTP "+response.status};
    }
    return {ok:false,reason:"Too many redirects"};
  } catch(error) {
    const cause=error as {code?:string;cause?:{code?:string}};
    return {ok:false,reason:/CERT|TLS|SSL/.test(cause.code??cause.cause?.code??"")?"TLS certificate error":"Link unavailable or timed out"};
  }
}
/** One build checks each URL once; failures are retried on the next build. */
export function createLinkChecker(check:LinkChecker=checkOfficialLink):LinkChecker {
  const cache=new Map<string,Promise<LinkCheck>>();
  return url=>{if(!cache.has(url))cache.set(url,check(url));return cache.get(url)!;};
}
export function projectLinkUrls(p:EmailProject) {
  const d=p.data,s=p.snapshot;
  return [...new Set([s.officialRecordUrl,...(d.officialRecords??[]).map(r=>r.url),d.commentUrl,d.conditionsSource,
    ...d.impacts.map(i=>i.url),d.item.visual?.sourceUrl,...(d.documents??[]).map(r=>r.url),
    ...Object.entries(d.next??{}).filter(([key,value])=>/url|source/i.test(key)&&typeof value==="string").map(([,value])=>value as string),
    ...Object.entries(s.next??{}).filter(([key,value])=>/url|source/i.test(key)&&typeof value==="string").map(([,value])=>value as string)]
    .filter((url):url is string=>!!url&&/^https?:/i.test(url)&&new URL(url).hostname!==new URL(SITE_ORIGIN).hostname))];
}
export async function verifyProjectLinks(project:EmailProject,check=createLinkChecker()):Promise<EmailProject> {
  const checks=Object.fromEntries(await Promise.all(projectLinkUrls(project).map(async url=>[url,await check(url)] as const)));
  for(const url of [project.snapshot.officialRecordUrl,project.snapshot.next?.agendaUrl].filter((url):url is string=>!!url)) {
    const result=checks[url];if(result?.ok&&result.url&&!caseSpecificRecordUrl(result.url,project.snapshot.caseNumbers??[project.snapshot.caseId]))checks[url]={ok:false,reason:"Redirect lost the case-specific record"};
  }
  for(const [url,result] of Object.entries(checks))if(!result.ok)console.warn("[email-link]",JSON.stringify({areaId:project.snapshot.areaId,caseId:project.snapshot.caseId,url,reason:result.reason}));
  return {...project,linkChecks:checks};
}
