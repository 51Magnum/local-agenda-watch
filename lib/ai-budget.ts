import {databaseUrl} from "./runtime-environment";
import { Pool } from "./database-pool";
import { randomUUID } from "node:crypto";
export class AiBudgetExceeded extends Error {
  constructor() {
    super(
      "AI work deferred: daily budget reserved or exhausted; retry tomorrow",
    );
  }
}
export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
};
// USD per million tokens. Official pricing: https://developers.openai.com/api/docs/models/gpt-4.1-mini
export function modelPrices(model: string) {
  if (/^gpt-4\.1-mini(?:-\d{4}-\d\d-\d\d)?$/.test(model))
    return { input: 0.4, cached: 0.1, output: 1.6 };
  const input = Number(process.env.OPENAI_INPUT_USD_PER_MILLION),
    output = Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION);
  if (!(input > 0 && output > 0))
    throw Error("AI work deferred: configure prices for " + model);
  return { input, cached: input, output };
}
export const budgetLimit = () => {
  const n = Number(process.env.OPENAI_DAILY_BUDGET_USD ?? 3);
  return Number.isFinite(n) && n >= 0 ? n : 3;
};
export function usageCost(model: string, usage: Usage) {
  const p = modelPrices(model),
    input = Math.max(0, usage.input_tokens ?? 0),
    cached = Math.min(
      input,
      Math.max(0, usage.input_tokens_details?.cached_tokens ?? 0),
    );
  return (
    ((input - cached) * p.input +
      cached * p.cached +
      Math.max(0, usage.output_tokens ?? 0) * p.output) /
    1e6
  );
}
export function reserveCost(
  model: string,
  content: object[],
  instructions: string,
  schema: object,
  maxOutput: number,
) {
  // UTF-8 bytes conservatively bound text tokens; reserve the full model input limit for PDFs.
  const text = JSON.stringify([
    instructions,
    schema,
    content.map((c) =>
      Object.fromEntries(
        Object.entries(c).filter(
          ([k]) => !["image_url", "file_data"].includes(k),
        ),
      ),
    ),
  ]);
  const tokens = content.some((c) => "file_data" in c)
    ? 1047576
    : Math.min(
        1047576,
        Buffer.byteLength(text) +
          1024 +
          content.filter((c) => "image_url" in c).length * 8192,
      );
  return usageCost(model, { input_tokens: tokens, output_tokens: maxOutput });
}
type Query = (
  sql: string,
  values?: unknown[],
) => Promise<{ rows: Record<string, unknown>[] }>;
export function createBudgetLedger(query: Query) {
  let ready: Promise<unknown> | undefined;
  const init = () =>
    (ready ??= query(
      `CREATE TABLE IF NOT EXISTS law_ai_days(day date PRIMARY KEY,spent numeric NOT NULL DEFAULT 0,reserved numeric NOT NULL DEFAULT 0,input_tokens bigint NOT NULL DEFAULT 0,output_tokens bigint NOT NULL DEFAULT 0);CREATE TABLE IF NOT EXISTS law_ai_calls(id uuid PRIMARY KEY,day date NOT NULL,operation text NOT NULL,model text NOT NULL,reservation numeric NOT NULL,cost numeric,input_tokens bigint,output_tokens bigint,created_at timestamptz NOT NULL DEFAULT now());`,
    )
      .then(async () => {
        const exists = await query(
          "SELECT to_regclass('public.law_timeline_runs') AS table_name",
        );
        if (exists.rows[0]?.table_name)
          await query(
            `INSERT INTO law_ai_days(day,spent,input_tokens,output_tokens) SELECT (now() AT TIME ZONE 'UTC')::date,coalesce(sum(coalesce((data->>'costUsd')::numeric,coalesce((data->'tokenTotals'->>'input')::numeric,0)*.4/1000000+coalesce((data->'tokenTotals'->>'output')::numeric,0)*1.6/1000000)),0),coalesce(sum((data->'tokenTotals'->>'input')::bigint),0),coalesce(sum((data->'tokenTotals'->>'output')::bigint),0) FROM law_timeline_runs WHERE left(data->>'startedAt',10)=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD') ON CONFLICT DO NOTHING`,
          );
      })
      .catch((e) => {
        ready = undefined;
        throw e;
      }));
  return {
    async reserve(
      operation: string,
      model: string,
      amount: number,
      limit = budgetLimit(),
      now = new Date(),
    ) {
      await init();
      const day = now.toISOString().slice(0, 10),
        id = randomUUID();
      const result = await query(
        `WITH reserved AS (INSERT INTO law_ai_days(day,reserved) SELECT $1::date,$2::numeric WHERE $2::numeric<=$3::numeric ON CONFLICT(day) DO UPDATE SET reserved=law_ai_days.reserved+excluded.reserved WHERE law_ai_days.spent+law_ai_days.reserved+excluded.reserved<=$3::numeric RETURNING day) INSERT INTO law_ai_calls(id,day,operation,model,reservation) SELECT $4,day,$5,$6,$2 FROM reserved RETURNING id`,
        [day, amount, limit, id, operation, model],
      );
      if (!result.rows.length) throw new AiBudgetExceeded();
      return id;
    },
    async settle(id: string, model: string, usage: Usage) {
      await init();
      const cost = usageCost(model, usage);
      await query(
        `WITH settled AS (UPDATE law_ai_calls SET cost=$2,input_tokens=$3,output_tokens=$4 WHERE id=$1 AND cost IS NULL RETURNING day,reservation) UPDATE law_ai_days d SET spent=d.spent+$2::numeric,reserved=greatest(0,d.reserved-s.reservation),input_tokens=d.input_tokens+$3::bigint,output_tokens=d.output_tokens+$4::bigint FROM settled s WHERE d.day=s.day`,
        [id, cost, usage.input_tokens ?? 0, usage.output_tokens ?? 0],
      );
      return cost;
    },
    async today() {
      await init();
      const r = await query(
        "SELECT spent,reserved,input_tokens,output_tokens FROM law_ai_days WHERE day=$1",
        [new Date().toISOString().slice(0, 10)],
      );
      return {
        limit: budgetLimit(),
        spent: Number(r.rows[0]?.spent ?? 0),
        reserved: Number(r.rows[0]?.reserved ?? 0),
        inputTokens: Number(r.rows[0]?.input_tokens ?? 0),
        outputTokens: Number(r.rows[0]?.output_tokens ?? 0),
      };
    },
  };
}
let pool: Pool;
const ledger = createBudgetLedger(async (sql, values) => {
  if (!databaseUrl())
    throw Error("AI work deferred: durable budget database unavailable");
  pool ??= new Pool({ connectionString: databaseUrl(), max: 2 });
  return pool.query(sql, values);
});
export const aiBudget = ledger;
