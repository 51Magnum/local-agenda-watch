import {afterEach,expect,it,vi} from "vitest";
import {readMapSnapshot} from "@/lib/maps/store";
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
