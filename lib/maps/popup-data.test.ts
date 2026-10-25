import {CASE_EVIDENCE} from "@/lib/case-evidence";
import {expect,it,vi} from "vitest";
import {emptyEvidenceState} from "@/lib/timeline/types";
import {AREAS} from "@/lib/areas/registry";
import type {MapCase,JurisdictionConfig} from "./types";
vi.mock("@/lib/timeline/public",()=>({readTimelineState:vi.fn(async()=>emptyEvidenceState())}));
vi.mock("./image-review-store",()=>({publicImageReviews:vi.fn(async()=>[]),displayedImageReviews:vi.fn(rows=>rows)}));
import {enrichMapPopups} from "./popup-data";
it("shows Americrete's verified current request and explanation and logs missing extraction without inventing expansion",async()=>{
 const log=vi.spyOn(console,"info").mockImplementation(()=>{});
 const config={id:"nampa",area:AREAS.nampa,reviewedApplications:{"ANN-00368-2026":{...CASE_EVIDENCE["ANN-00368-2026"].applicationCopy!,reportUrl:CASE_EVIDENCE["ANN-00368-2026"].reportUrl!}},loadCases:async()=>({active:[],upcomingOnly:[],completed:[],agendaMeetings:[]})} as unknown as JurisdictionConfig;
 const c={id:"ANN-00368-2026",title:"Americrete annexation",stage:"Council/Board"} as MapCase;
 const [result]=await enrichMapPopups(config,[c]);expect(result.popup?.headline).toBe("Annex 148.52 acres for existing concrete operations");expect(result.popup?.explanation).toContain("existing concrete plant and gravel pit");expect(result.popup?.aiGenerated).toBe(false);expect(JSON.stringify(result.popup)).not.toContain("expansion");expect(log).toHaveBeenCalledWith("[map-popup:copy-fallback]",expect.stringContaining('"caseId":"ANN-00368-2026"'));log.mockRestore();
});

it("shares a verified curated project's approved image with its explicitly linked plat case",async()=>{const {publicImageReviews}=await import("./image-review-store");const visual={src:"/api/maps/nampa/visual/verified",label:"Concept plan",sourceUrl:"https://official.example/plan.pdf"};vi.mocked(publicImageReviews).mockResolvedValueOnce([{caseIds:["ANN-00371-2026"],visual}] as never);const config={id:"nampa",area:AREAS.nampa,loadCases:async()=>({active:[],completed:[]})} as unknown as JurisdictionConfig;const [item]=await enrichMapPopups(config,[{id:"SPP-00184-2026",title:"Braeburn Creek",stage:"Council/Board"} as MapCase]);expect(publicImageReviews).toHaveBeenLastCalledWith("nampa",expect.arrayContaining(["SPP-00184-2026","ANN-00371-2026"]));expect(item.visual?.src).toBe(visual.src);});
