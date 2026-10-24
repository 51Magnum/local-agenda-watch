import {expect,it,vi} from "vitest";
import {load} from "cheerio";
import {renderToStaticMarkup} from "react-dom/server";
import {AREAS,publicArea} from "./registry";
import {residentHref} from "./record-links";
import {createRecordAreaPages} from "./record-pages";
import {countyFromFeature,countyTitle,countySummary,countyStage,COUNTY_CASE_LAYER} from "@/lib/sources/canyon-county";
import {composeMeridianFeed,meridianRecordUrl,type MeridianCase} from "@/lib/sources/meridian";
vi.mock("@/lib/maps/store",()=>({readMapSnapshot:async()=>({cases:[{id:"CR2025-0012",flumCategories:["Residential"],geometry:null}]})}));
const raw=COUNTY_CASE_LAYER+"/query?f=pjson";
it("rejects raw APIs, regardless of capitalization, while retaining readable documents",()=>{
 for(const url of [raw,"https://example.com/QUERY?x=1","https://example.com/data?f=pjson","javascript:alert(1)"])expect(residentHref(url)).toBeUndefined();
 expect(residentHref("https://weblink.meridiancity.org/WebLink/DocView.aspx?id=123")).toContain("DocView");
});
it("registry builders select actual case documents or hearings, never invented GIS records",()=>{
 expect(AREAS["canyon-county"].recordPage!({urls:[raw]})).toBeUndefined();
 expect(AREAS["canyon-county"].recordPage!({urls:[raw,"https://landhearingsagenda.canyoncounty.id.gov/Landing?eventId=123"]})).toContain("eventId=123");
 expect(AREAS.meridian.recordPage!({urls:[raw,"https://weblink.meridiancity.org/WebLink/DocView.aspx?id=123"]})).toContain("DocView");
 expect(AREAS["canyon-county"].recordPage!({urls:[raw],baseRecordUrl:"https://agenda.canyoncounty.id.gov/Agenda.pdf"})).toContain("Agenda.pdf");
});
it.each(["CR2025-0012","OR2022-0006","AD2025-0020-APL","ZV2026-0004"])("%s renders no raw public links and keeps genuine hearing provenance",async id=>{
 const h=countyFromFeature({properties:{OBJECTID:12,PermitNum:id}});
 h.county.events=[{id:"123",caseIds:[id],name:"Example",address:"",body:"P&Z",date:"2026-10-20",startsAt:"2026-10-20",sourceUrl:"https://landhearingsagenda.canyoncounty.id.gov/Landing?eventId=123",documents:[],linkedIds:[]}];
 const page=createRecordAreaPages({areaId:"canyon-county",loadFeed:async()=>({active:[h],completed:[]}),record:()=>h.county,title:countyTitle,summary:countySummary,stage:countyStage,sourceLabel:"County",sourceUrl:"https://landhearingsagenda.canyoncounty.id.gov/Landing",dataWindow:"Current"});
 const html=renderToStaticMarkup(await page.case({params:Promise.resolve({planNumber:id})}));
 const $=load(html);for(const a of $("a[href]").toArray())expect(residentHref($(a).attr("href")), $(a).attr("href")).toBeTruthy();
 expect(html).toContain("eventId=123");expect(html).not.toContain("Official hearing and supporting documents");
 if(id==="CR2025-0012")expect($("a").toArray().some(a=>$(a).attr("href")==="/us/id/canyon-county/map?flum=1&case=CR2025-0012")).toBe(true);
});
it("a record with only GIS provenance has a plain source label and no fake link",async()=>{
 const h=countyFromFeature({properties:{OBJECTID:12,PermitNum:"CR2025-0012"}});
 const page=createRecordAreaPages({areaId:"canyon-county",loadFeed:async()=>({active:[h],completed:[]}),record:()=>h.county,title:countyTitle,summary:countySummary,stage:countyStage,sourceLabel:"County",sourceUrl:"https://landhearingsagenda.canyoncounty.id.gov/Landing",dataWindow:"Current"});
 const $=load(renderToStaticMarkup(await page.case({params:Promise.resolve({planNumber:h.appId})})));
 expect($.text()).toContain("Source: Canyon County planning records");expect($("a[href]").toArray().some(a=>/rest\/services|f=pjson/.test($(a).attr("href")!))).toBe(false);
});
it("agenda-only Meridian cases stay present and use their agenda without a database query",()=>{
 const feed=composeMeridianFeed([],[],[{id:"1",body:"City Council",bodyLabel:"City Council",title:"Council",date:"2026-11-03",dateLabel:"Nov 3",sourceUrl:"https://meetings.municode.com/portal",agendaUrl:"https://meetings.municode.com/agenda",items:[{title:"Public Hearing: Example (H-2026-0047, SHP-2026-0011)",caseIds:["H-2026-0047","SHP-2026-0011"],agendaUrl:"https://meetings.municode.com/agenda",staffReports:[]}]}]);
 expect(feed.active).toHaveLength(2);
 for(const h of feed.active){expect(meridianRecordUrl(h as MeridianCase)).toBe("");expect(h.meetings[0].sourceUrl).toContain("/agenda");}
 expect(countyFromFeature({properties:{PermitNum:"AD2025-0020-APL"}}).externalUrl).toBeNull();
});

it("registry builders do not cross the React client-prop boundary",()=>{expect(publicArea(AREAS.meridian)).not.toHaveProperty("recordPage");expect(AREAS.meridian.recordPage).toBeTypeOf("function");});
