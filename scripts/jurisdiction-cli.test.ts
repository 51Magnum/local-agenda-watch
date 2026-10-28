import {execFileSync} from "node:child_process";
import {expect,it} from "vitest";
it("forwards list --public and excludes private review jurisdictions without network access",()=>{
 const ids=execFileSync(process.execPath,["scripts/run-jurisdiction.mjs","list","--public"],{encoding:"utf8",env:{...process.env,LAW_SITE_REVIEW_AREAS:"",VERCEL_ENV:"production"}}).trim().split(/\r?\n/);
 expect(ids).toHaveLength(7);expect(ids).not.toContain("ada-county");expect(ids).not.toContain("boise");
});
