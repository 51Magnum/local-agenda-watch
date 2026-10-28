import {afterEach,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
import robots from "../app/robots";
import {proxy} from "../proxy";
import {environmentMetadata,metadataOrigin} from "./environment-metadata";
import {projectMetadata} from "./project-seo";
import type {PaneData} from "./maps/project-questions";
afterEach(()=>vi.unstubAllEnvs());
const project={area:{id:"ada-county",name:"Ada County"},item:{id:"202601398-CU",title:"Contractor yard",href:"/us/id/ada-county/plan/202601398-CU"}} as PaneData;
it.each(["preview","development",""])("disallows indexing and production canonicals for %s",env=>{
 vi.stubEnv("VERCEL_ENV",env);vi.stubEnv("VERCEL_BRANCH_URL","ada-review.example.vercel.app");
 expect(robots()).toEqual({rules:{userAgent:"*",disallow:"/"}});
 expect(environmentMetadata().robots).toEqual({index:false,follow:false});expect(metadataOrigin()).toBe("https://ada-review.example.vercel.app");
 const meta=projectMetadata(project);expect(meta.alternates?.canonical).toBe("https://ada-review.example.vercel.app/us/id/ada-county/plan/202601398-CU");
 expect(meta.openGraph?.url).toBe(meta.alternates?.canonical);
 for(const path of ["/","/api/maps/nampa","/nampa","/admin","/maplibre/worker.mjs"]){expect(proxy(new NextRequest("https://preview.test"+path))?.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");}
});
it("preserves production robots, canonical origin and ordinary proxy behavior",()=>{
 vi.stubEnv("VERCEL_ENV","production");
 expect(robots().rules).toMatchObject({allow:["/","/api/og/"]});expect(environmentMetadata().robots).toBeUndefined();
 expect(metadataOrigin()).toBe("https://www.localagendawatch.com");
 expect(proxy(new NextRequest("https://www.localagendawatch.com/"))).toBeUndefined();
});
