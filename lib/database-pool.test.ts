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

it("enforces read-only PostgreSQL connections and blocks mutation helpers in production dry runs",async()=>{
 vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("LAW_READ_ONLY","true");vi.stubEnv("DATABASE_URL","postgres://prod.invalid/main");
 const {databaseUrl,productionWritesAllowed}=await import("./runtime-environment");
 expect(databaseUrl()).toBe("postgres://prod.invalid/main");expect(productionWritesAllowed()).toBe(false);
 const pool=new Pool({connectionString:databaseUrl()});expect(mocks.configs[0].options).toContain("default_transaction_read_only=on");
 await pool.query("SELECT 1");expect(mocks.query).toHaveBeenCalledOnce();
 await pool.query("CREATE TABLE x(id text)");expect(mocks.query).toHaveBeenCalledOnce();
 expect(()=>pool.query("UPDATE law_alert_subscriptions SET state=NULL")).toThrow("Writes are disabled");
});
