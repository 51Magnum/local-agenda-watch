import {afterEach,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
const h=vi.hoisted(()=>({state:vi.fn()}));
vi.mock("@/lib/jurisdictions/publication-state",()=>({publicationState:h.state}));
import PublicationControls from "./publication-controls";
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();});
it("makes a passing but paused area explicit and offers Resume publication",async()=>{
 h.state.mockResolvedValue({status:"paused",publiclyVisible:false,checksPassed:true,canResume:true,publishedRecords:38,reason:"Checks pass, but publication is paused."});
 const html=renderToStaticMarkup(await PublicationControls({areaId:"ada-county"}));expect(html).toContain("Ada County: Paused");expect(html).toContain('value="resume"');expect(html).toContain("Resume publication");expect(html).not.toContain('disabled=""');
});
it("disables unsafe resume and keeps Preview controls read-only",async()=>{
 h.state.mockResolvedValue({status:"paused",publiclyVisible:false,checksPassed:false,canResume:false,publishedRecords:0,reason:"Current check failed"});
 expect(renderToStaticMarkup(await PublicationControls({areaId:"ada-county"}))).toContain('disabled=""');
 vi.stubEnv("VERCEL_ENV","preview");const html=renderToStaticMarkup(await PublicationControls({areaId:"ada-county"}));expect(html).not.toContain("<form");expect(html).toContain("not available in preview");
});
