import {expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({save:vi.fn()}));
vi.mock("./store",()=>({readStaging:async()=>undefined,saveStaging:h.save,jurisdictionTransaction:vi.fn(),jurisdictionDb:vi.fn()}));
vi.mock("./adapters/arcgis",()=>({applicationAdapter:()=>({listApplications:async()=>[]}),arcgisAdapter:()=>({query:async()=>({type:"FeatureCollection",features:[{type:"Feature",properties:{county_name:"Ada"},geometry:{type:"Polygon",coordinates:[[[-117,43],[-115,43],[-115,44],[-117,44],[-117,43]]]}}]})})}));
vi.mock("./adapters",()=>({agendaAdapter:()=>({listMeetings:async()=>[{id:"pdf",body:"bocc",title:"Board",date:"2026-10-14",meetingPageUrl:"https://apps.adacounty.id.gov/agenda.pdf",attachments:[],items:[]}],getMeeting:async()=>{throw Error("Iterator is not defined");}})}));
vi.mock("./libraries",()=>({discoverStagingLibraries:async()=>{}}));
import {collectJurisdiction} from "./collect";
import {SourceHttp} from "./http";
it("marks a PDF.js Iterator failure incomplete and preserves staging",async()=>{
 const http=new SourceHttp();vi.spyOn(http,"text").mockRejectedValue(Error("Unavailable optional calendar"));
 const snapshot=await collectJurisdiction("ada-county",{http,now:new Date("2026-10-31")});expect(snapshot.complete).toBe(false);expect(snapshot.skipped.some(s=>s.reason.includes("Iterator is not defined"))).toBe(true);
 await expect(collectJurisdiction("ada-county",{http,write:true,now:new Date("2026-10-31")})).rejects.toThrow("incomplete");expect(h.save).not.toHaveBeenCalled();
});
