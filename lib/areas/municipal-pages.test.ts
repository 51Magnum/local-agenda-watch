import {it,expect,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {createRecordAreaPages} from "./record-pages";
import {municipalFromFeature,municipalRecord,municipalStage,municipalSummary,municipalTitle} from "@/lib/sources/municipal";
vi.mock("@/lib/maps/store",()=>({readMapSnapshot:async()=>undefined}));
it("shows notice documents and a sourced hearing on a citywide case without an empty map",async()=>{
 const h=municipalFromFeature("kuna",{properties:{OBJECTID:1,Project:"Transmission line regulations",Case_No:"26-05-OA",Decision:"Pending"}});h.meetings=[{body:"P&Z",bodyLabel:"Planning & Zoning Commission",date:"2026-10-27",dateLabel:"Oct 27",time:"18:00",sourceUrl:"https://example.com/notice.pdf",continuedNote:null}];h.municipal.documents=[{label:"Public hearing notice",filename:"Notice",url:"https://example.com/notice.pdf",sourceUrl:"https://example.com"}];
 const page=createRecordAreaPages({areaId:"kuna",loadFeed:async()=>({active:[h],completed:[]}),record:municipalRecord,title:municipalTitle,summary:municipalSummary,stage:municipalStage,sourceLabel:"City",sourceUrl:"https://example.com",dataWindow:"Current notices"});
 const html=renderToStaticMarkup(await page.case({params:Promise.resolve({planNumber:h.appId})}));expect(html).toContain("Public hearing notice");expect(html.indexOf("Public hearing notice")).toBeLessThan(html.indexOf("All official files"));expect(html).toContain("October 27, 2026");expect(html).not.toContain("Project map");
});
it("a decided city tracker case hides Next step and keeps its official outcome",async()=>{
 const h=municipalFromFeature("kuna",{properties:{OBJECTID:2,Project:"Example subdivision",Case_No:"26-01-S",Decision:"Denied"}});
 const page=createRecordAreaPages({areaId:"kuna",loadFeed:async()=>({active:[],completed:[h]}),record:municipalRecord,title:municipalTitle,summary:municipalSummary,stage:municipalStage,sourceLabel:"City",sourceUrl:"https://example.com",dataWindow:"Current tracker"});
 const html=renderToStaticMarkup(await page.case({params:Promise.resolve({planNumber:h.appId})}));expect(html).toContain("Decided");expect(html).toContain("Denied");expect(html).not.toContain("Next step");expect(html).not.toContain("Submitted");
});
