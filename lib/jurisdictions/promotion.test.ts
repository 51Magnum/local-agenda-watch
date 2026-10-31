import {expect,it,vi,afterEach} from "vitest";
const database=vi.hoisted(()=>({snapshot:undefined as unknown,qa:undefined as unknown,approvals:[] as unknown[]}));
vi.mock("pg",()=>({Pool:class{async query(sql:string){if(sql.startsWith("CREATE"))return{rows:[]};if(sql.includes("FROM law_jurisdiction_qa"))return{rows:database.qa?[{data:database.qa}]:[]};if(sql.includes("FROM law_jurisdiction_snapshots"))return{rows:database.snapshot?[{data:database.snapshot}]:[]};if(sql.includes("FROM law_jurisdiction_approvals"))return{rows:database.approvals,rowCount:database.approvals.length};throw Error("Unexpected SQL");}}}));
import {promoteStaging,snapshotHash,type StagingSnapshot} from "./store";
afterEach(()=>vi.unstubAllEnvs());
it("refuses public promotion without current passing QA and an explicit recorded admin approval",async()=>{
 vi.stubEnv("DATABASE_URL","postgres://fixture");
 database.snapshot={areaId:"boise",launchStatus:"admin_only"};database.qa=undefined;database.approvals=[];
 await expect(promoteStaging("boise","public")).rejects.toThrow("passing QA");
 database.qa={id:"qa-fixture",passed:true,snapshotHash:snapshotHash(database.snapshot as StagingSnapshot)};
 await expect(promoteStaging("boise","public")).rejects.toThrow("recorded admin approval");
 database.approvals=[{id:"owner-approved",admin_user:"owner",approved_at:new Date()}];
 await expect(promoteStaging("boise","public")).resolves.toMatchObject({approvalId:"owner-approved"});
 database.snapshot={areaId:"boise",launchStatus:"admin_only",checkedAt:"new collection clock",health:[],runtime:{environment:"production",gitCommit:"new",checks:[]}};
 await expect(promoteStaging("boise","public")).resolves.toMatchObject({approvalId:"owner-approved"});
 database.snapshot={areaId:"boise",launchStatus:"admin_only",applications:[{recordId:"changed reviewed content"}]};
 await expect(promoteStaging("boise","public")).rejects.toThrow("current passing QA");
});
