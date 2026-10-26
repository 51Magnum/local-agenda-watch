import { expect, it } from "vitest";
import { protectMapCase } from "./residential-privacy";
import { projectMetadata } from "./project-seo";
import type { MapCase } from "./maps/types";
import type { PaneData } from "./maps/project-questions";
it("removes resident names from public titles, summaries, popup copy, and metadata",()=>{
 const raw={id:"CUP-00413-2026",title:"In home occupational daycare for Melin",summary:"Melin at 17625 N Onaway Ave",typeLabel:"Conditional Use Permit",centroid:[-116.5,43.5],geometry:null,popup:{headline:"Melin daycare",projectName:"Melin",explanation:"Melin daycare request",progress:[]}} as unknown as MapCase;
 const item=protectMapCase("nampa",raw);
 expect(item.title).toBe("Home daycare permit");
 expect(JSON.stringify(item)).not.toContain("Melin");
 expect(item.visual).toBeUndefined();
 const metadata=projectMetadata({item,where:"17600 block of N Onaway Ave",area:{id:"nampa",name:"City of Nampa"}} as PaneData);
 expect(JSON.stringify(metadata)).not.toContain("Melin");
 expect(JSON.stringify(metadata)).toContain("Home daycare permit");
});
