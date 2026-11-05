import {afterEach,expect,it,vi} from "vitest";
const h=vi.hoisted(()=>({published:vi.fn(),save:vi.fn(),visible:vi.fn(),tag:vi.fn(),path:vi.fn(),map:vi.fn(()=>({areaId:"ada-county",cases:[{id:"approved"}]}))}));
vi.mock("next/cache",()=>({revalidatePath:h.path,revalidateTag:h.tag}));
vi.mock("../areas/registry",()=>({visibleAreas:h.visible}));
vi.mock("../maps/store",()=>({saveMapSnapshot:h.save}));
vi.mock("./self-check-store",()=>({readPublished:h.published}));
vi.mock("./resident-records",()=>({stagedMapSnapshot:h.map}));
import {refreshPublicationProjection} from "./publication-projection";
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();});
it("refreshes approved map data and invalidates stale routes, coverage and metadata",async()=>{
 h.published.mockResolvedValue({areaId:"ada-county",applications:[{recordId:"approved"}]});
 await refreshPublicationProjection("ada-county");expect(h.save).toHaveBeenCalledWith({areaId:"ada-county",cases:[{id:"approved"}]});
 expect(h.tag).toHaveBeenCalledWith("map-case-index-v1",{expire:0});expect(h.tag).toHaveBeenCalledWith("map-area:ada-county",{expire:0});
 expect(h.path).toHaveBeenCalledWith("/us/id/ada-county","layout");expect(h.path).toHaveBeenCalledWith("/api/map/meta");expect(h.path).toHaveBeenCalledWith("/api/map/boundaries");
});
it("never creates public map data for paused/unpublished records",async()=>{
 h.published.mockResolvedValue(undefined);await refreshPublicationProjection("ada-county");
 expect(h.save).not.toHaveBeenCalled();expect(h.path).toHaveBeenCalledWith("/");
});
it("blocks direct Preview projection writes before any reads or cache work",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");await expect(refreshPublicationProjection("ada-county")).rejects.toThrow("disabled");
 expect(h.visible).not.toHaveBeenCalled();expect(h.published).not.toHaveBeenCalled();expect(h.tag).not.toHaveBeenCalled();
});
