import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MeetingList from "./meeting-list";
it("includes meeting content and linked project outcomes in server HTML",()=>{
 const html=renderToStaticMarkup(<MeetingList year={2026} area={{id:"nampa",name:"Example city",timezone:"America/Denver"}} initial={{updatedAt:null,unavailable:false,rows:[{id:"council:2026-10-19",date:"2026-10-19",startsAt:"2026-10-20T00:00:00Z",title:"City Council",body:"City Council",caseIds:["CUP-00001-2026"],links:[],projects:[{caseId:"CUP-00001-2026",headline:"Home daycare permit",href:"/us/id/nampa/plan/CUP-00001-2026",outcome:"Approved"}]}]}}/>);
 expect(html).toContain("Home daycare permit");expect(html).toContain("Approved");expect(html).toContain("Mountain Time");expect(html).toContain('href="/us/id/nampa/plan/CUP-00001-2026"');expect(html.match(/City Council/g)).toHaveLength(2); // filter option and one meeting heading
 expect(html).not.toContain("Loading meeting filters");
});
