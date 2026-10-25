import { it, expect, vi, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
const state = vi.hoisted(() => ({ db: undefined as unknown as PGlite }));
vi.mock("pg", () => ({
  Pool: class {
    async query(sql: string, values?: unknown[]) {
      return values?.length
        ? state.db.query(sql, values)
        : (await state.db.exec(sql)).at(-1);
    }
  },
}));
vi.mock("./maps/project-detail", () => ({ projectDetail: vi.fn() }));
import { subscribeAlert, confirmAlert, unsubscribeAlert } from "./alerts";
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
      await state.db.query(
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
  } finally {
    await state.db.close();
  }
});
