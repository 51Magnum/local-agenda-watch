import {expect,it,vi} from "vitest";
import {jurisdiction} from "./registry";
import {applicationRecordUrl} from "./application-source";
import {verificationUrl} from "./record-links";
import {selfCheck,type LinkEvidence} from "./self-check";
import {publicApplicationFields,hasPublicFieldProjection} from "./public-fields";
import {applicationFromFeature} from "./adapters/arcgis";
import {SourceHttp} from "./http";
import type {Application} from "./adapters/types";
import type {StagingSnapshot} from "./store";
const d=jurisdiction("boise"),id="PLN26-00001",description="Construct a commercial warehouse.";
const app=():Application=>({recordId:id,relatedCaseNumbers:[],name:id,type:"Conditional Use",status:"In review",address:"",parcel:[],description,recordUrl:applicationRecordUrl(d,id),sourceUrl:applicationRecordUrl(d,id),sourceFields:{RecordID:id,ProjectType:"Conditional Use",Description:description}});
const snapshot=(a:Application):StagingSnapshot=>({areaId:d.id,launchStatus:"admin_only",checkedAt:"2026-11-05",range:{start:"2026-08-01",end:"2026-12-20"},applications:[a],meetings:[],complete:true,health:[],skipped:[]});
const target="https://permits.cityofboise.org/CitizenAccess/Cap/CapDetail.aspx?capID1=26CAP&capID2=00000&capID3=00001&agencyCode=BOISE";
const links=(a:Application,redirect=target,dataId=id)=>async(url:string):Promise<LinkEvidence>=>url===a.recordUrl?{status:302,text:"",redirectUrl:redirect}:{status:200,text:JSON.stringify({features:[{attributes:{RecordID:dataId,Description:a.description}}]})};
it("accepts an actual official case redirect only alongside the exact restricted source row",async()=>{
 const a=app(),r=await selfCheck(d,snapshot(a),{links:links(a)});expect(r.goLive).toBe(true);expect(r.queue).toEqual([]);
 for(const redirect of [target.replace("permits.cityofboise.org","outside.test"),target.replace("CapDetail.aspx","Login.aspx"),target.replace("capID1=26CAP&",""),target.replace("agencyCode=BOISE","agencyCode=OTHER")])expect((await selfCheck(d,snapshot(a),{links:links(a,redirect)})).records[0].publish).toBe(false);
 expect((await selfCheck(d,snapshot(a),{links:links(a,target,"WRONG-ID")})).records[0].publish).toBe(false);
});
it("collects only public source columns and never treats missing policy as an approval",async()=>{
 const fields=publicApplicationFields(d)!;expect(fields).not.toContain("RecordName");
 const a=applicationFromFeature(d,{type:"Feature",geometry:null,properties:{...app().sourceFields,RecordName:"Jane Smith",APPLICANT:"Jane Smith"}});
 expect(a.sourceFields).not.toHaveProperty("APPLICANT");expect(a.name).toBe(id);expect(hasPublicFieldProjection(d,a.sourceFields)).toBe(true);
 a.sourceFields.Owner="Jane Smith";expect(hasPublicFieldProjection(d,a.sourceFields)).toBe(false);
 const missing={...d,applications:{...d.applications,params:{...d.applications.params,publicFields:undefined}}};expect(hasPublicFieldProjection(missing,app().sourceFields)).toBe(false);
 expect(()=>publicApplicationFields({...d,applications:{...d.applications,params:{...d.applications.params,publicFields:[...fields,"ApplicantName"]}}})).toThrow();
});
it("accepts source null only when the resident description is empty and still rejects contact leaks",async()=>{
 const a=app();a.sourceFields.Description=null;a.description="";expect((await selfCheck(d,snapshot(a),{links:links(a)})).counts["description-verbatim"].pass).toBe(1);
 a.description="An invented description";expect((await selfCheck(d,snapshot(a),{links:links(a)})).counts["description-verbatim"].uncertain).toBe(1);
 a.description="Contact planner@example.test";a.sourceFields.Description=a.description;expect((await selfCheck(d,snapshot(a),{links:links(a)})).counts.privacy.fail).toBe(1);
});
it("preserves redirect status and does not fetch an unverified or foreign destination",async()=>{
 const fetch=vi.fn(async()=>new Response(null,{status:302,headers:{location:target}})),http=new SourceHttp({fetch,delayMs:0,redirects:d.recordLinks!.redirects});
 const proof=await http.request(app().recordUrl,{method:"HEAD"},undefined,true);expect(proof.health.status).toBe(302);expect(proof.verifiedRedirect).toBe(target);expect(fetch).toHaveBeenCalledOnce();
 fetch.mockResolvedValueOnce(new Response(null,{status:302,headers:{location:"https://outside.test/"}}));await expect(http.request(app().recordUrl,{method:"HEAD"},undefined,true)).rejects.toThrow("Redirect requires verification");expect(fetch).toHaveBeenCalledTimes(2);
 expect(verificationUrl(d,id)).toContain("outFields=RecordID,Status,ProjectType,Description,ChildRecords");
});

it("bounds parallel evidence requests to two per official host",async()=>{
 let active=0,peak=0;const fetch=vi.fn(async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,10));active--;return new Response("ok");});
 const http=new SourceHttp({fetch,delayMs:0,concurrency:2});await Promise.all(Array.from({length:6},(_,i)=>http.request("https://concurrency.official.test/"+i)));expect(peak).toBe(2);
});

it("checks published status/type values for contacts even with a safe source-field projection",async()=>{
 for(const key of ["status","type"] as const){const a=app();a[key]="Contact planner@example.test";expect((await selfCheck(d,snapshot(a),{links:links(a)})).counts.privacy.fail).toBe(1);}
});
