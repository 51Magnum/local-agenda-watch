import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {jurisdiction} from "./registry";
import type {ReviewSnapshot} from "./review-snapshot";
it("ships a passing Boise review with contact-free resident data and no withheld document links",()=>{
 const raw=readFileSync("data/review/boise.json","utf8"),s=JSON.parse(raw) as ReviewSnapshot;
 expect(s.selfCheck.goLive).toBe(true);expect(s.selfCheck.passRate).toBeGreaterThanOrEqual(jurisdiction("boise").selfCheck!.minPassRate!);expect(raw.replaceAll("%40","@")).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
 const withheld=new Set(s.selfCheck.records.flatMap(r=>r.withheldDocuments?.map(d=>d.url)??[]));
 for(const record of s.records){expect(record.project.item.title).not.toBe("[Resident title withheld]");if(record.eligible)expect(record.project.item.title.length).toBeLessThanOrEqual(70);for(const doc of record.project.documents??[])expect(withheld.has(doc.url)).toBe(false);}
 expect(s.records.some(r=>!r.eligible)).toBe(true);
});
