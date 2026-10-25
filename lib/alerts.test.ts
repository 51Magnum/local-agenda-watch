import { it, expect, vi, afterEach } from "vitest";
import {
  parseWatchTarget,
  watchMatches,
  watchFingerprint,
  sendAlertMail,
  alertReadiness,
} from "./alerts";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("validates coordinates and matches projects from every jurisdiction in a saved radius", () => {
  const target = parseWatchTarget({
    kind: "place",
    label: "Victory & Happy Valley",
    coordinates: [-116.5, 43.5],
    radiusMiles: 1,
  });
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [-116.5, 43.5],
        [-116.499, 43.5],
        [-116.499, 43.501],
        [-116.5, 43.501],
        [-116.5, 43.5],
      ],
    ],
  };
  const rows = [
    { id: "CITY", areaId: "nampa", geometry },
    { id: "COUNTY", areaId: "canyon-county", geometry },
  ] as Parameters<typeof watchMatches>[1];
  expect(watchMatches(target, rows)).toHaveLength(2);
  expect(() =>
    parseWatchTarget({ ...target, coordinates: [200, 40] }),
  ).toThrow();
  expect(() => parseWatchTarget({ ...target, radiusMiles: 0 })).toThrow();
  expect(watchFingerprint(rows[0])).not.toBe(
    watchFingerprint({ ...rows[0], stage: "Decided" }),
  );
});
it("keeps waitlist delivery disabled and includes reply-to, mailing address, idempotency and one-click unsubscribe in mail", async () => {
  vi.stubEnv("RESEND_API_KEY", "test");
  vi.stubEnv("ALERTS_MAILING_ADDRESS", "123 Example St, Example, ID 00000");
  vi.stubEnv("ALERTS_WAITLIST_CONFIRMATIONS_ENABLED", "false");
  const send = vi.fn().mockResolvedValue(Response.json({ id: "message" }));
  vi.stubGlobal("fetch", send);
  expect(alertReadiness().waitlistEnabled).toBe(false);
  await sendAlertMail({
    to: "test@example.test",
    subject: "Test",
    text: "Confirmation",
    key: "test/1",
    unsubscribe: "https://example.test/api/alerts/unsubscribe?token=abc",
  });
  const options = send.mock.calls[0][1],
    body = JSON.parse(options.body);
  expect(options.headers["Idempotency-Key"]).toBe("test/1");
  expect(body.reply_to).toBe("hello@localagendawatch.com");
  expect(body.text).toContain("123 Example St");
  expect(body.headers["List-Unsubscribe-Post"]).toBe(
    "List-Unsubscribe=One-Click",
  );
});
