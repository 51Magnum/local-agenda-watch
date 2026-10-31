import {afterEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({query:vi.fn().mockResolvedValue({rows:[],rowCount:0}),configs:[] as Record<string,unknown>[]}));
vi.mock("pg",()=>({Pool:class{query=mocks.query;constructor(config:Record<string,unknown>){mocks.configs.push(config);}}}));
import {Pool} from "./database-pool";
afterEach(()=>{vi.unstubAllEnvs();mocks.query.mockClear();mocks.configs.length=0;});
it.each([false,true])("throws before creating any preview pool (signup=%s)",previewSignups=>{
 vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("DATABASE_URL","");
 expect(()=>new Pool({previewSignups})).toThrow("not available in preview");expect(mocks.configs).toHaveLength(0);
});
it("leaves production queries unchanged",async()=>{vi.stubEnv("VERCEL_ENV","production");const pool=new Pool({connectionString:"postgres://prod.invalid/main"});await pool.query("CREATE TABLE x(id text)");expect(mocks.query).toHaveBeenCalledOnce();expect(mocks.configs[0].options).toBeUndefined();});
