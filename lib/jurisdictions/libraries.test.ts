import {expect,it,vi,afterEach} from "vitest";
import {walkLibrary} from "../timeline/libraries";
import type {EvidenceStore} from "../timeline/store";
import type {EvidenceState} from "../timeline/types";

afterEach(()=>vi.unstubAllGlobals());

it("descends from an empty staff-report folder into nested agency reports and prefers the final map PDF",async()=>{
 const root="https://kunacityid.sharepoint.com/sites/Planning/Shared%20Documents/Forms/AllItems.aspx?id=/sites/Planning/Shared%20Documents/26-04-PP";
 // Source access is mocked at the boundary; the public-folder walker itself runs.
 const access=await import("../timeline/source-access");
 const allowed=vi.spyOn(access,"allowedSource").mockReturnValue(true);
 const request=vi.spyOn(access,"sourceRequest").mockImplementation(async url=>{
  if(url===root)return new Response("<html>Official case folder</html>",{headers:{"content-type":"text/html"}});
  const files=url.includes("AGENCY%20COMMENTS")||url.includes("AGENCY COMMENTS")?[{Name:"ACHD DRAFT.pdf",ServerRelativeUrl:"/sites/Planning/26-04-PP/AGENCY COMMENTS/ACHD DRAFT.pdf"},{Name:"ACHD FINAL.pdf",ServerRelativeUrl:"/sites/Planning/26-04-PP/AGENCY COMMENTS/ACHD FINAL.pdf"}]:[];
  const folders=url.includes("AGENCY")||url.includes("STAFF")?[]:[{Name:"STAFF REPORT",ServerRelativeUrl:"/sites/Planning/26-04-PP/STAFF REPORT"},{Name:"AGENCY COMMENTS",ServerRelativeUrl:"/sites/Planning/26-04-PP/AGENCY COMMENTS"}];
  return Response.json({Files:files,Folders:folders});
 });
 const state={folderQueues:{}} as EvidenceState;
 const store={read:async()=>state,mutate:async(fn:(s:EvidenceState)=>unknown)=>fn(state)} as EvidenceStore;
 try{const files=await walkLibrary("kuna","26-04-PP",root,store,Date.now()+10000);expect(files.map(f=>f.title)).toEqual(["ACHD FINAL.pdf"]);expect(request.mock.calls.some(([url])=>url.includes("AGENCY"))).toBe(true);}finally{allowed.mockRestore();request.mockRestore();}
});
