import{expect,it}from"vitest";
import{AREAS,areaPath,findArea,stageLabel}from"./registry";
import{liveAreaAtPoint,locationMapUrl}from"./coverage";
import{readFile,readdir}from"node:fs/promises";
import path from"node:path";
it("routes a Nampa address to its canonical map with a point and nearby ring",()=>{const coords:[number,number]=[-116.573553,43.627026];expect(liveAreaAtPoint(coords)?.id).toBe("nampa");const url=new URL(locationMapUrl(coords)!,"https://example.com");expect(url.pathname).toBe("/us/id/nampa/map");expect(url.searchParams.get("lat")).toBe("43.627026");expect(url.searchParams.get("lng")).toBe("-116.573553");expect(url.searchParams.get("nearby")).toBe("1");});
it("keeps Boise and incorporated Caldwell uncovered while enabling County coverage",()=>{expect(liveAreaAtPoint([-116.2023,43.615])).toBeUndefined();expect(findArea("us","id","canyon-county")).toMatchObject({status:"live",type:"county"});expect(AREAS["canyon-county"].boundary.type).toBe("MultiPolygon");expect(Object.values(AREAS).filter(a=>a.status==="live")).toHaveLength(3);expect(liveAreaAtPoint([-116.6886,43.6629])).toBeUndefined();expect(liveAreaAtPoint([-116.9,43.65])?.id).toBe("canyon-county");});
it("supports county authority labels without changing shared templates",()=>{expect(stageLabel("Council hearing",AREAS["canyon-county"])).toBe("Board hearing");expect(areaPath(AREAS["canyon-county"])).toBe("/us/id/canyon-county");});
it("keeps city-specific literal names out of shared components",async()=>{async function scan(dir:string):Promise<string[]>{const items=await readdir(dir,{withFileTypes:true});return(await Promise.all(items.map(i=>i.isDirectory()?scan(path.join(dir,i.name)):/\.(tsx?|css)$/.test(i.name)?[path.join(dir,i.name)]:[]))).flat();}for(const file of await scan(path.join(process.cwd(),"app","components")))expect(await readFile(file,"utf8"),file).not.toContain("Nampa");});

it("routes Meridian city limits to its own area",()=>{expect(liveAreaAtPoint([-116.3915,43.6121])?.id).toBe("meridian");});
