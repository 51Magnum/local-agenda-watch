import {load} from "cheerio";
import {residentHref} from "../lib/areas/record-links";
async function main(){
const origin=new URL(process.argv[2]??"http://localhost:3010");
const pages=["/us/id/canyon-county/plan/CR2025-0012","/us/id/canyon-county/plan/OR2022-0006","/us/id/canyon-county/plan/AD2025-0020-APL","/us/id/canyon-county/plan/ZV2026-0004","/us/id/meridian/plan/H-2025-0001","/us/id/meridian/plan/H-2026-0047","/us/id/meridian/plan/SHP-2026-0011","/us/id/nampa/braeburn-creek"];
const internal=new Set<string>();
let failures=0;
for(const path of pages){
 const response=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(120000)});
 if(response.status!==200){console.error(path+": HTTP "+response.status);failures++;continue;}
 const $=load(await response.text());
 for(const a of $("a[href]").toArray()){
  const href=$(a).attr("href")!;if(href.startsWith("#")||href.startsWith("mailto:"))continue;
  if(!residentHref(href)){console.error(path+": invalid public link "+href);failures++;continue;}
  const url=new URL(href,origin);url.hash="";
  if(url.origin===origin.origin||url.hostname==="www.localagendawatch.com"){url.protocol=origin.protocol;url.host=origin.host;internal.add(url.href);}
 }
 console.log("Checked "+path);
}
const urls=[...internal];
for(let i=0;i<urls.length;i+=4)await Promise.all(urls.slice(i,i+4).map(async url=>{
 const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
 if(response.status!==200){console.error(new URL(url).pathname+": HTTP "+response.status);failures++;}
 await response.body?.cancel();
}));
console.log(`${pages.length} sample pages, ${internal.size} internal links, ${failures} failures`);
if(failures)process.exitCode=1;

}
main().catch(error=>{console.error(error);process.exitCode=1;});
