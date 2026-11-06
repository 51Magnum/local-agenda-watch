import {expect,it,vi} from "vitest";
import {cachedEvidence,type EvidenceCache} from "./evidence-cache";
import {jurisdiction} from "./registry";
import type {StagingSnapshot} from "./store";
import type {LinkEvidence} from "./self-check";
import {selfCheck} from "./self-check";
const d=jurisdiction("boise"),id="PLN26-00001",url="https://www.cityofboise.org/meeting";
const snapshot=():StagingSnapshot=>({areaId:d.id,launchStatus:"admin_only",checkedAt:"2026-11-05T16:00:00Z",range:{start:"2026-08-01",end:"2026-12-20"},applications:[{recordId:id,agendaOnly:true,relatedCaseNumbers:[],name:"Official hearing",type:"Conditional Use",status:"In review",description:"Construct a commercial warehouse.",address:"",parcel:[],recordUrl:url,sourceUrl:url,sourceFields:{agendaOnly:true}}],meetings:[],complete:true,health:[],skipped:[]});
function memory(){const rows:Record<string,Record<string,LinkEvidence>>={};return {read:vi.fn(async(cycle:string)=>rows[cycle]??={}),write:vi.fn(async(cycle:string,url:string,proof:LinkEvidence)=>{rows[cycle]??={};rows[cycle][url]=proof;})} satisfies EvidenceCache;}
it("resumes verified evidence without storing source prose or changing evidence hashes",async()=>{
 const s=snapshot(),raw={status:200,text:"<h1>"+id+"</h1> Staff contact private@example.test"},reader=vi.fn(async()=>raw),cache=memory();
 const original=await selfCheck(d,s,{links:reader});const first=await selfCheck(d,s,{links:cachedEvidence(d,s,reader,cache)});const calls=reader.mock.calls.length;
 const second=await selfCheck(d,s,{links:cachedEvidence(d,s,reader,cache)});expect(reader).toHaveBeenCalledTimes(calls);expect(second.records[0].sourceHash).toBe(original.records[0].sourceHash);expect(first.records[0].sourceHash).toBe(original.records[0].sourceHash);
 const stored=cache.write.mock.calls[0][2];expect(stored.text).toBe(id);expect(JSON.stringify(stored)).not.toContain("private@example.test");
});
it("invalidates proof on source data, collection timestamp or configuration changes",async()=>{
 const s=snapshot(),cache=memory(),reader=vi.fn(async()=>({status:200,text:id}));await cachedEvidence(d,s,reader,cache)(url);
 await cachedEvidence(d,{...s,checkedAt:"2026-11-05T17:00:00Z"},reader,cache)(url);
 const changed=structuredClone(s);changed.applications[0].description="A revised proposal.";await cachedEvidence(d,changed,reader,cache)(url);
 await cachedEvidence({...d,recordLinks:{...d.recordLinks!,dataLabel:"Revised official source"}},s,reader,cache)(url);expect(reader).toHaveBeenCalledTimes(4);
});
it("does not reuse unavailable or untrusted redirect evidence",async()=>{
 for(const proof of [{status:0,text:""},{status:302,text:"",redirectUrl:"https://outside.test/"}]){
  const reader=vi.fn(async()=>proof),cache=memory(),s=snapshot();await cachedEvidence(d,s,reader,cache)(url);await cachedEvidence(d,s,reader,cache)(url);expect(reader).toHaveBeenCalledTimes(2);expect(cache.write).not.toHaveBeenCalled();
 }
});

it("retains attempted blocked/unreadable documents within this cycle instead of repeatedly hitting them",async()=>{
 for(const proof of [{status:403,text:"",reason:"Official access blocked"},{status:200,text:"",readable:false}]){
  const reader=vi.fn(async()=>proof),cache=memory(),s=snapshot();await cachedEvidence(d,s,reader,cache)(url);await cachedEvidence(d,s,reader,cache)(url);expect(reader).toHaveBeenCalledOnce();
 }
});

it("retains thrown access failures without converting them into successful evidence",async()=>{
 const {SourceFailure}=await import("./http"),reader=vi.fn(async()=>{throw new SourceFailure({state:"blocked",status:403,url,reason:"Access denied",latencyMs:0,checkedAt:"2026-11-06T00:00:00Z"});}),cache=memory(),s=snapshot();
 const read=cachedEvidence(d,s,reader,cache);expect((await read(url)).status).toBe(403);expect((await read(url)).status).toBe(403);expect(reader).toHaveBeenCalledOnce();expect((await selfCheck(d,s,{links:read})).goLive).toBe(false);
});
