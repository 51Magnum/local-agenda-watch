import {expect,it} from "vitest";
import {snapshotHash} from "./snapshot-hash";
import type {StagingSnapshot} from "./store";
const snapshot:StagingSnapshot={areaId:"ada-county",launchStatus:"admin_only",checkedAt:"2026-10-27T12:00:00Z",range:{start:"2026-08-01",end:"2026-12-01"},applications:[],meetings:[],health:[],skipped:[],complete:true};
it("ignores collection clocks, endpoint health, runtime checks and moving date windows",()=>{
 const refresh={...snapshot,checkedAt:"2026-10-28T12:00:00Z",range:{start:"2026-08-02",end:"2026-12-02"},health:[{url:"https://official.test",state:"ok" as const,latencyMs:200,checkedAt:"2026-10-28"}],runtime:{environment:"production",gitCommit:"new",checks:[]},skipped:[{url:"https://official.test",reason:"Timing changed"}]};
 expect(snapshotHash(refresh)).toBe(snapshotHash(snapshot));
});
it("uses stable key order but invalidates approval for changed content or incomplete collection",()=>{
 expect(snapshotHash(Object.fromEntries(Object.entries(snapshot).reverse()) as StagingSnapshot)).toBe(snapshotHash(snapshot));
 expect(snapshotHash({...snapshot,complete:false})).not.toBe(snapshotHash(snapshot));
 expect(snapshotHash({...snapshot,applications:[{recordId:"202601398-CU",description:"Changed proposal"} as never]})).not.toBe(snapshotHash(snapshot));
});
