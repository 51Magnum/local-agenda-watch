import { it, expect, vi, afterEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  aiBudget,
  createBudgetLedger,
  AiBudgetExceeded,
  reserveCost,
  usageCost,
} from "./ai-budget";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("atomically blocks overlapping calls at a $0.01 ceiling, then replaces reservations with actual usage exactly once", async () => {
  const db = new PGlite();
  try {
    const ledger = createBudgetLedger(async (sql, values) =>
      values?.length ? db.query(sql, values) : (await db.exec(sql)).at(-1)!,
    );
    const first = await ledger.reserve("summary", "gpt-4.1-mini", 0.006, 0.01);
    const results = await Promise.allSettled([
      ledger.reserve("image", "gpt-4.1-mini", 0.003, 0.01),
      ledger.reserve("image", "gpt-4.1-mini", 0.003, 0.01),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason,
    ).toBeInstanceOf(AiBudgetExceeded);
    await ledger.settle(first, "gpt-4.1-mini", {
      input_tokens: 100,
      output_tokens: 20,
    });
    await ledger.settle(first, "gpt-4.1-mini", {
      input_tokens: 100,
      output_tokens: 20,
    });
    const day = await ledger.today();
    expect(day.spent).toBeCloseTo(0.000072, 8);
    expect(day.reserved).toBeCloseTo(0.003, 8);
    await expect(
      ledger.reserve("huge", "gpt-4.1-mini", 0.02, 0.01),
    ).rejects.toThrow("daily budget");
  } finally {
    await db.close();
  }
});
it("reserves PDF context and requested output before calling, accounts for cached tokens, and fails closed on an unpriced model", () => {
  expect(
    reserveCost(
      "gpt-4.1-mini",
      [{ type: "input_file", file_data: "data:application/pdf;base64,AA==" }],
      "",
      {},
      512,
    ),
  ).toBeGreaterThan(0.01);
  expect(
    usageCost("gpt-4.1-mini", {
      input_tokens: 1000,
      input_tokens_details: { cached_tokens: 500 },
      output_tokens: 100,
    }),
  ).toBeCloseTo(0.00041, 8);
  expect(() => reserveCost("unknown", [], "", {}, 10)).toThrow(
    "configure prices",
  );
});

it("blocks an actual structured-response attempt before fetch with OPENAI_DAILY_BUDGET_USD=0.01", async () => {
  const db = new PGlite();
  try {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.stubEnv("OPENAI_DAILY_BUDGET_USD", "0.01");
    const ledger = createBudgetLedger(async (sql, values) =>
      values?.length ? db.query(sql, values) : (await db.exec(sql)).at(-1)!,
    );
    vi.spyOn(aiBudget, "reserve").mockImplementation((...args) =>
      ledger.reserve(...args),
    );
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { structuredResponse } = await import("./timeline/extract");
    await expect(
      structuredResponse(
        "case_evidence",
        {},
        [{ type: "input_text", text: "Source report" }],
        "Extract facts",
        { maxOutputTokens: 16000 },
      ),
    ).rejects.toThrow("daily budget");
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    await db.close();
  }
});
