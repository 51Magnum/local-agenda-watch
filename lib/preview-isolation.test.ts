import {afterEach,expect,it,vi} from "vitest";
import {readdirSync,readFileSync} from "node:fs";
import path from "node:path";
import {productionWritesAllowed,previewMutationResponse,requireProductionMutation,databaseUrl} from "./runtime-environment";
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
const routes=[...files("app/api/cron"),...files("app/admin")].filter(f=>f.endsWith("route.ts"));
it.each(["preview","development",""])("refuses mutations for environment %s",env=>{
 vi.stubEnv("VERCEL_ENV",env);expect(productionWritesAllowed()).toBe(false);expect(previewMutationResponse()?.status).toBe(403);expect(()=>requireProductionMutation()).toThrow("disabled");
});
it("keeps production mutation authorization unchanged",()=>{vi.stubEnv("VERCEL_ENV","production");expect(previewMutationResponse()).toBeUndefined();expect(()=>requireProductionMutation()).not.toThrow();});
it("ignores every database DSN in preview",()=>{
 vi.stubEnv("DATABASE_URL","postgres://prod.invalid/main");vi.stubEnv("DATABASE_URL_PREVIEW","postgres://preview.invalid/staging");
 vi.stubEnv("VERCEL_ENV","preview");expect(databaseUrl()).toBeUndefined();
 vi.stubEnv("VERCEL_ENV","production");expect(databaseUrl()).toBe("postgres://prod.invalid/main");
});
const guarded=routes.flatMap(file=>[...readFileSync(file,"utf8").matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)].filter(m=>m[1]!=="GET"||file.includes("cron")).map(m=>({file,method:m[1]})));
it.each(guarded)("blocks $method $file before authentication, leases or database work",async({file,method})=>{
 vi.stubEnv("VERCEL_ENV","preview");
 const route=await import(path.resolve(file));
 const response=await route[method](new Request("https://preview.test/",{method}));
 expect(response.status).toBe(403);expect(await response.text()).toContain("disabled in preview");
});
it("blocks direct staging/approval/promotion/map/privacy writes outside routes",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");
 const store=await import("./jurisdictions/store"),maps=await import("./maps/store"),privacy=await import("./residential-privacy-store");
 await expect(store.saveStaging({} as never)).rejects.toThrow("disabled");await expect(store.saveQa({} as never)).rejects.toThrow("disabled");
 await expect(store.approveQa("ada-county","qa","admin")).rejects.toThrow("disabled");await expect(store.promoteStaging("ada-county","public")).rejects.toThrow("disabled");
 await expect(maps.saveMapSnapshot({} as never)).rejects.toThrow("disabled");await expect(privacy.setPrivacyOverride("ada-county","case","public","test")).rejects.toThrow("disabled");
});
