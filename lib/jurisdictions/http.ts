import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type {SourceHealth} from "./adapters/types";
export class SourceFailure extends Error {constructor(public health:SourceHealth){super(health.state+": "+health.url+" — "+health.reason);}}
export type HttpData={bytes:Uint8Array;health:SourceHealth;headers:Record<string,string>};
type Cache={etag?:string;lastModified?:string;headers:Record<string,string>;data:string;at:string};
const queues=new Map<string,Promise<unknown>>();
export class SourceHttp {
 readonly checks:SourceHealth[]=[];
 constructor(private options:{fetch?:typeof fetch;cacheDir?:string;maxBytes?:number;delayMs?:number;timeoutMs?:number;allowedHosts?:string[]}={}){}
 private async work(url:string,init:RequestInit={},maxBytes=this.options.maxBytes??45000000):Promise<HttpData>{
  const start=Date.now(),now=new Date().toISOString(),u=new URL(url);
  if(u.protocol!=="https:"||u.username||u.password||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname)||this.options.allowedHosts&&!this.options.allowedHosts.includes(u.hostname))throw Error("Source URL is outside the configured official hosts");
  const cacheDir=this.options.cacheDir??(process.env.VERCEL?path.join(os.tmpdir(),"law-jurisdiction-http"):path.join(process.cwd(),".data","jurisdiction-http")),hash=createHash("sha256").update(url+JSON.stringify([init.method??"GET",init.body??""])).digest("hex"),file=path.join(cacheDir,hash+".json");
  let cached:Cache|undefined;try{cached=JSON.parse(await readFile(file,"utf8"));}catch{}
  const headers=new Headers(init.headers);headers.set("User-Agent","LocalAgendaWatch/1.0 (+https://www.localagendawatch.com; hello@localagendawatch.com)");
  if(cached?.etag)headers.set("If-None-Match",cached.etag);if(cached?.lastModified)headers.set("If-Modified-Since",cached.lastModified);
  const finish=(state:SourceHealth["state"],status?:number,bytes?:number,reason?:string)=>{const health:SourceHealth={url,state,status,latencyMs:Date.now()-start,bytes,reason,checkedAt:now};this.checks.push(health);return health;};
  for(let attempt=0;attempt<3;attempt++){
   try{
    const r=await(this.options.fetch??fetch)(url,{...init,headers,redirect:"manual",signal:AbortSignal.timeout(this.options.timeoutMs??20000)});
    if(r.status===304&&cached){const bytes=new Uint8Array(Buffer.from(cached.data,"base64"));if(bytes.length>maxBytes)throw new SourceFailure(finish("skipped",304,bytes.length,"Cached attachment exceeds byte cap"));return{bytes,health:finish("ok",304,bytes.length),headers:cached.headers};}
    if(r.status>=300&&r.status<400)throw new SourceFailure(finish("unavailable",r.status,0,"Redirect requires verification of the destination: "+(r.headers.get("location")??"")));
    if(Number(r.headers.get("content-length"))>maxBytes){await r.body?.cancel();throw new SourceFailure(finish("skipped",r.status,0,"Attachment exceeds byte cap"));}
    const chunks:Uint8Array[]=[];let length=0;
    if(r.body){const reader=r.body.getReader();for(;;){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.length;if(length>maxBytes){await reader.cancel();throw new SourceFailure(finish("skipped",r.status,length,"Response exceeds byte cap"));}chunks.push(chunk.value);}}
    const bytes=Buffer.concat(chunks),sample=bytes.subarray(0,24000).toString("utf8");
    if(/cf-chl-|cf-mitigated|challenge-platform|<title>\s*Just a moment|Attention Required.*Cloudflare|<title>[^<]*verify you are human/i.test(sample)||r.headers.get("cf-mitigated")==="challenge")throw new SourceFailure(finish("blocked",r.status,length,"Access challenge; no automated bypass or retry"));
    if(!r.ok){if([429,500,502,503,504].includes(r.status)&&attempt<2){await new Promise(resolve=>setTimeout(resolve,500*2**attempt));continue;}throw new SourceFailure(finish(r.status===403?"blocked":"unavailable",r.status,length,"HTTP "+r.status));}
    const resultHeaders=Object.fromEntries(r.headers);const entry:Cache={etag:r.headers.get("etag")??undefined,lastModified:r.headers.get("last-modified")??undefined,headers:resultHeaders,data:bytes.toString("base64"),at:now};await mkdir(cacheDir,{recursive:true});await writeFile(file,JSON.stringify(entry));return{bytes:new Uint8Array(bytes),health:finish("ok",r.status,length),headers:resultHeaders};
   }catch(e){if(e instanceof SourceFailure)throw e;if(attempt<2){await new Promise(resolve=>setTimeout(resolve,500*2**attempt));continue;}throw new SourceFailure(finish("unavailable",undefined,undefined,e instanceof Error?e.message:"Request failed"));}
  }
  throw Error("Source retry exhausted");
 }
 async request(url:string,init:RequestInit={},maxBytes?:number){const host=new URL(url).hostname,previous=queues.get(host)??Promise.resolve();const task=previous.catch(()=>{}).then(()=>this.work(url,init,maxBytes));queues.set(host,task.finally(()=>new Promise(resolve=>setTimeout(resolve,this.options.delayMs??250))).catch(()=>{}));return task;}
 async text(url:string,init:RequestInit={},maxBytes?:number){return new TextDecoder().decode((await this.request(url,init,maxBytes)).bytes);}
 async json<T=Record<string,unknown>>(url:string,init:RequestInit={}){return JSON.parse(await this.text(url,init)) as T;}
}
