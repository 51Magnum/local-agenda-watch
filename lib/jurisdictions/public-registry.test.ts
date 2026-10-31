import {expect,it} from "vitest";
import {publicAreaEntries} from "./generated-public";
import {registryEntries} from "./generated";
import {AREAS as client} from "../areas/public-registry";
import {AREAS as server} from "../areas/registry";
it("ships only enabled, approved public entries and no static geometry or private ingestion configuration",()=>{
 expect(publicAreaEntries.map(a=>a.id).sort()).toEqual(registryEntries.filter(d=>d.enabled&&d.launchStatus==="public").map(d=>d.id).sort());
 expect(JSON.stringify(publicAreaEntries)).not.toMatch(/ada-county|\bboise\b|AdaFileBrowse|backfillUsd|coordinates|escribemeetings|iqm2/i);
 for(const area of Object.values(client)){expect(area).not.toHaveProperty("boundary");expect(area).not.toHaveProperty("timeline");expect(area.bodies).toEqual(server[area.id].bodies);expect(area.timezone).toBe(server[area.id].timezone);}
});
