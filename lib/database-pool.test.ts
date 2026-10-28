import {afterEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({query:vi.fn().mockResolvedValue({rows:[],rowCount:0}),configs:[] as Record<string,unknown>[]}));
vi.mock("pg",()=>({Pool:class{query=mocks.query;constructor(config:Record<string,unknown>){mocks.configs.push(config);}}}));
import {Pool} from "./database-pool";
afterEach(()=>{vi.unstubAllEnvs();mocks.query.mockClear();mocks.configs.length=0;});
it("uses a read-only preview session, never issuing runtime schema or seed SQL",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("DATABASE_URL_PREVIEW","postgres://preview.invalid/staging");
 const pool=new Pool({connectionString:"postgres://prod.invalid/main"});
 expect(mocks.configs[0]).toMatchObject({connectionString:"postgres://preview.invalid/staging",options:" -c default_transaction_read_only=on"});
 await pool.query("CREATE TABLE x(id text); INSERT INTO x VALUES('test')");expect(mocks.query).not.toHaveBeenCalled();
 expect(()=>pool.query("UPDATE x SET id='test'")).toThrow("disabled");
 await pool.query("SELECT data FROM law_jurisdiction_snapshots");expect(mocks.query).toHaveBeenCalledOnce();
});
it("leaves production queries unchanged",async()=>{vi.stubEnv("VERCEL_ENV","production");const pool=new Pool({connectionString:"postgres://prod.invalid/main"});await pool.query("CREATE TABLE x(id text)");expect(mocks.query).toHaveBeenCalledOnce();expect(mocks.configs[0].options).toBeUndefined();});
it("allows scoped signup writes only in an explicitly separate preview database",async()=>{
 vi.stubEnv("VERCEL_ENV","preview");vi.stubEnv("DATABASE_URL","postgres://prod.invalid/main");vi.stubEnv("DATABASE_URL_PREVIEW","postgres://preview.invalid/staging");
 const pool=new Pool({connectionString:process.env.DATABASE_URL,previewSignups:true});await pool.query("INSERT INTO law_alert_subscriptions VALUES('test')");expect(mocks.query).toHaveBeenCalledOnce();expect(mocks.configs[0].connectionString).toContain("preview.invalid");
});
