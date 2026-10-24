import {afterEach,expect,it,vi} from "vitest";
import {readFlumSnapshot,readMapSnapshot} from "@/lib/maps/store";
import {GET} from "./route";
vi.mock("@/lib/maps/store",()=>({readMapSnapshot:vi.fn(),readFlumSnapshot:vi.fn()}));
afterEach(()=>vi.resetAllMocks());
it("queries bounded cases for both city and county and emits one stage scheme",async()=>{
 vi.mocked(readMapSnapshot).mockImplementation(async id=>({version:1,jurisdiction:id,updatedAt:"2026-10-24",warnings:[],cases:[{id:id+"-CASE",title:"Project",summary:"Proposal",type:"ANN",typeLabel:"Annexation",stage:"P&Z",href:"/us/id/"+id+"/plan/CASE",citywide:false,source:"polygon",confidence:"exact",centroid:[-116.51,43.576],geometry:{type:"Polygon",coordinates:[[[-116.51,43.576],[-116.509,43.576],[-116.509,43.577],[-116.51,43.577],[-116.51,43.576]]]},flumCategories:[]}]}));
 const r=await GET(new Request("https://example.test/api/maps/nearby?lat=43.5756774&lng=-116.5099174&r=1"));const data=await r.json();
 expect(r.status).toBe(200);expect(data.areas.map((a:{id:string})=>a.id)).toEqual(expect.arrayContaining(["nampa","canyon-county"]));
 expect(data.cases).toHaveLength(1);expect(data.cases[0].members).toHaveLength(2);
 for(const [id,options]of vi.mocked(readMapSnapshot).mock.calls){expect(["nampa","canyon-county"]).toContain(id);expect(options).toMatchObject({includeFlum:false,bounds:expect.arrayContaining([expect.any(Number)])});expect(options?.bounds).toHaveLength(4);}
});
it("validates a bounded radius before reading any map data",async()=>{
 for(const q of ["lat=invalid&lng=1","lat=43&lng=-116&r=100","lat=43&lng=-116&r=0"]){expect((await GET(new Request("https://example.test/api/maps/nearby?"+q))).status).toBe(400);}
 expect(readMapSnapshot).not.toHaveBeenCalled();
});

it("opens all covered areas when an address is cleared instead of applying a hidden one-mile radius",async()=>{
 vi.mocked(readMapSnapshot).mockImplementation(async id=>({version:1,jurisdiction:id,updatedAt:"2026-10-24",warnings:[],cases:[]}));
 const response=await GET(new Request("https://example.test/api/maps/nearby?overview=1&country=us&state=id"));const data=await response.json();
 expect(response.status).toBe(200);expect(data.overview).toBe(true);expect(data.areas).toHaveLength(7);
 expect(data.jurisdiction.bounds[2]-data.jurisdiction.bounds[0]).toBeGreaterThan(.5);
});
it("loads FLUM by viewport without requiring an address or radius",async()=>{
 vi.mocked(readFlumSnapshot).mockResolvedValue({updatedAt:"2026-10-24",legend:[],geojson:{type:"FeatureCollection",features:[]}});
 const response=await GET(new Request("https://example.test/api/maps/nearby?bbox=-116.7,43.4,-116.3,43.8&layer=flum"));
 expect(response.status).toBe(200);expect(readMapSnapshot).not.toHaveBeenCalled();
 expect(readFlumSnapshot).toHaveBeenCalledWith("nampa",{bounds:[-116.7,43.4,-116.3,43.8]});
});
it("rejects malformed viewport bounds before loading plans",async()=>{
 expect((await GET(new Request("https://example.test/api/maps/nearby?bbox=NaN,43,-116,44&layer=flum"))).status).toBe(400);
 expect(readFlumSnapshot).not.toHaveBeenCalled();
});
