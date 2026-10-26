import { it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { emailProject } from "./email/project";
import type { PaneData } from "./maps/project-questions";
import { PGlite } from "@electric-sql/pglite";
const state = vi.hoisted(() => ({ db: undefined as unknown as PGlite }));
vi.mock("pg", () => ({
  Pool: class {
    async query(sql: string, values?: unknown[]) {
      return values?.length
        ? state.db.query(sql, values)
        : (await state.db.exec(sql)).at(-1);
    }
    async connect(){return {query:this.query.bind(this),release(){}};}
  },
}));
vi.mock("./maps/project-detail", () => ({ projectDetail: vi.fn() }));
import { subscribeAlert, confirmAlert, unsubscribeAlert, sendDigests } from "./alerts";
import { projectDetail } from "./maps/project-detail";
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("requires confirmation, hashes confirmation tokens, supports unsubscribe, and enforces durable email/IP limits", async () => {
  state.db = new PGlite();
  try {
    vi.stubEnv("DATABASE_URL", "test");
    vi.stubEnv("RESEND_API_KEY", "test");
    vi.stubEnv("ALERTS_MAILING_ADDRESS", "Example mailing address");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ALERTS_DELIVERY_ENABLED", "true");
    const project:PaneData={area:{id:"nampa",name:"City of Nampa",timezone:"America/Denver",planningBody:"P&Z",decisionBody:"City Council"},item:{id:"ANN-00371-2026",title:"Braeburn Creek",href:"/us/id/nampa/braeburn-creek",type:"ANN",typeLabel:"Annexation",summary:"",stage:"In review",geometry:null,centroid:null,source:"none",confidence:"approximate",citywide:false,flumCategories:[],popup:{projectName:"Braeburn Creek",headline:"487 new homes on 138 acres",progress:[]}},history:[],impacts:[],conditions:[],caseIds:["ANN-00371-2026"],updatedAt:"2026-10-26"};
    vi.mocked(projectDetail).mockResolvedValue(project);
    const send = vi
      .fn()
      .mockImplementation(async () => Response.json({ id: "sent" }));
    vi.stubGlobal("fetch", send);
    const target = {
      kind: "project" as const,
      areaId: "nampa",
      caseId: "ANN-00371-2026",
    };
    await subscribeAlert("first@example.test", target, "one");
    const message = JSON.parse(send.mock.calls[0][1].body).text as string,
      token = message.match(/confirm\?token=([\w-]+)/)![1],
      unsub = message.match(/unsubscribe\?token=([\w-]+)/)![1];
    const before = (
      await state.db.query<{confirm_hash:string;confirmed_at:string|null}>(
        "SELECT confirm_hash,confirmed_at FROM law_alert_subscriptions",
      )
    ).rows[0];
    expect(before.confirmed_at).toBeNull();
    expect(before.confirm_hash).not.toBe(token);
    expect(await confirmAlert("wrong")).toBeFalsy();
    expect(await confirmAlert(token)).toEqual(target);
    expect(await unsubscribeAlert(unsub)).toBe(true);
    expect(await confirmAlert(token)).toBeFalsy();
    await subscribeAlert("limited@example.test", target, "two");
    await subscribeAlert("limited@example.test", target, "three");
    await subscribeAlert("limited@example.test", target, "four");
    expect(
      (await subscribeAlert("limited@example.test", target, "five")).limited,
    ).toBe(true);
    for (let i = 0; i < 5; i++)
      expect(
        (await subscribeAlert("ip" + i + "@example.test", target, "shared"))
          .limited,
      ).toBe(false);
    expect(
      (await subscribeAlert("sixth@example.test", target, "shared")).limited,
    ).toBe(true);
    // Durable end-to-end batch: one person has 251 watches, another has one.
    // A mail failure must leave every failed watch untouched and allow the next person through.
    await state.db.exec("CREATE TABLE law_map_cases(area_id text,data jsonb)");
    const current=emailProject(project).snapshot,old={...current,headline:"Previous proposal"};
    for(let i=0;i<252;i++)await state.db.query("INSERT INTO law_alert_subscriptions(id,scope,email,target,confirm_hash,confirm_expires,unsubscribe_token,confirmed_at,state) VALUES($1,'production',$2,$3,'hash',now()+interval '1 day',$4,now(),$5)",[randomUUID(),i<251?"batch-fail@example.test":"batch-ok@example.test",JSON.stringify({kind:"project",areaId:"nampa",caseId:"ANN-"+(90000+i)+"-2026"}),randomUUID(),JSON.stringify({version:2,projects:{[current.key]:old}})]);
    send.mockImplementation(async(_url:string,options:{body:string})=>{if(JSON.parse(options.body).to[0]==="batch-fail@example.test")throw Error("Simulated provider outage");return Response.json({id:"sent"});});
    expect(await sendDigests()).toMatchObject({sent:1,checked:2,failures:1});
    expect((await state.db.query<{n:number}>("SELECT count(*)::int AS n FROM law_alert_subscriptions WHERE email='batch-fail@example.test' AND state->'projects'->$1->>'headline'='Previous proposal'",[current.key])).rows[0].n).toBe(251);
    expect((await state.db.query<{n:number}>("SELECT count(*)::int AS n FROM law_alert_subscriptions WHERE email='batch-ok@example.test' AND state->'projects'->$1->>'headline'=$2",[current.key,current.headline])).rows[0].n).toBe(1);
    expect((await state.db.query("SELECT attempts,status FROM law_alert_deliveries WHERE email='batch-fail@example.test'")).rows[0]).toMatchObject({attempts:1,status:"pending"});
    await state.db.exec("UPDATE law_alert_deliveries SET next_attempt=now()-interval '1 minute' WHERE status='pending'");
    send.mockImplementation(async()=>Response.json({id:"retry-sent"}));
    expect(await sendDigests()).toMatchObject({sent:1,failures:0});
    expect((await state.db.query<{n:number}>("SELECT count(*)::int AS n FROM law_alert_subscriptions WHERE email='batch-fail@example.test' AND state->'projects'->$1->>'headline'=$2",[current.key,current.headline])).rows[0].n).toBe(251);
  } finally {
    await state.db.close();
  }
});
