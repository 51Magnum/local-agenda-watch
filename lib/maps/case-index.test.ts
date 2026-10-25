import { expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
const h = vi.hoisted(() => ({ db: null as unknown as PGlite, calls: 0 }));
vi.mock("pg", () => ({
  Pool: class {
    async query(sql: string, params?: unknown[]) {
      h.calls++;
      return params?.length
        ? await h.db.query(sql, params)
        : ((await h.db.exec(sql)).at(-1) ?? { rows: [] });
    }
  },
}));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => {
    const memo = new Map();
    return (...args: unknown[]) => {
      const key = JSON.stringify(args);
      if (!memo.has(key)) memo.set(key, fn(...args));
      return memo.get(key);
    };
  },
}));
vi.mock("@/lib/timeline/public", () => ({
  readTimelineState: async () => ({ version: 1, documents: {}, fields: {} }),
}));
import { cachedViewport, exportMapFeatures, siteMembers, projectDirectory } from "./case-index";
it("indexes old snapshots once, deduplicates across areas, returns only lightweight features and performs no SQL on repeated cached views", async () => {
  const db = new PGlite();
  h.db = db;
  vi.stubEnv("DATABASE_URL", "test");
  await db.exec(
    "CREATE TABLE law_map_cache(jurisdiction text PRIMARY KEY,snapshot jsonb);CREATE TABLE law_map_index_meta(id text PRIMARY KEY,updated_at timestamptz);INSERT INTO law_map_index_meta VALUES('dates-v1',now())",
  );
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [-116.5, 43.5],
        [-116.49, 43.5],
        [-116.49, 43.51],
        [-116.5, 43.51],
        [-116.5, 43.5],
      ],
    ],
  };
  const c = {
    id: "ONE",
    title: "Example homes",
    summary: "Narrative must not travel with map features",
    stage: "In review",
    type: "plat",
    typeLabel: "Preliminary plat",
    geometry,
    centroid: [-116.495, 43.505],
    bounds: [-116.5, 43.5, -116.49, 43.51],
    source: "polygon",
    confidence: "exact",
    citywide: false,
    flumCategories: [],
    href: "/nampa/plan/ONE",
    parcelIds: ["R1"],
    parcelNamespace: "county.example",
    visual: { private: "must not return" },
  };
  for (const area of ["nampa", "canyon-county"])
    await db.query("INSERT INTO law_map_cache VALUES($1,$2::jsonb)", [
      area,
      JSON.stringify({
        cases: [
          {
            ...c,
            id: area === "nampa" ? "ONE" : "TWO",
            bounds: area === "nampa" ? c.bounds : undefined,
            href: "/" + area + "/plan/ONE",
          },
        ],
      }),
    ]);
  try {
    const data = await cachedViewport([-116.51, 43.49, -116.48, 43.52], 14);
    expect(data.cases).toHaveLength(1);
    expect(data.cases[0].members).toHaveLength(2);
    expect(data.cases[0].geometry).not.toBeNull();
    expect(data.cases[0].visual).toBeUndefined();
    expect(data.cases[0].summary).toBe("");
    const calls = h.calls;
    await cachedViewport([-116.51, 43.49, -116.48, 43.52], 14);
    expect(h.calls).toBe(calls);
    const shapes = await cachedViewport([-116.51, 43.49, -116.48, 43.52], 11);
    expect(shapes.cases[0].geometry).not.toBeNull();
    const points = await cachedViewport([-116.51, 43.49, -116.48, 43.52], 10);
    expect(points.cases[0].geometry).toBeNull();
    expect(points.cases[0].centroid![0]).toBeCloseTo(c.centroid[0], 6);
    expect(points.cases[0].centroid![1]).toBeCloseTo(c.centroid[1], 6);
    const linked = await siteMembers(c as never, "nampa");
    expect(linked?.map((m) => m.areaId).sort()).toEqual([
      "canyon-county",
      "nampa",
    ]);
    const exported = await exportMapFeatures();
    expect(exported.features).toHaveLength(2);
    expect(JSON.stringify(exported)).not.toContain("Narrative must not travel");
    expect(JSON.stringify(exported)).not.toContain("visual");
    expect(exported.nextCursor).toBeUndefined();
    const overview = await cachedViewport([-180, -85, 180, 85], 8);
    expect(overview.cases).toEqual([]);
    expect(overview.summaries.find((s) => s.id === "nampa")?.count).toBe(1);
    const directory = await projectDirectory();
    expect(directory).toHaveLength(2);
    expect(directory[0].title).toBe("Example homes");
    expect(JSON.stringify(directory)).not.toMatch(/geometry|Narrative must not travel|visual|coordinates/);
    const directoryCalls = h.calls;
    await projectDirectory();
    expect(h.calls).toBe(directoryCalls);
  } finally {
    vi.unstubAllEnvs();
    await db.close();
  }
});
