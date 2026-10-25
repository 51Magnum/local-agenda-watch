import { mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { AREAS } from "../lib/areas/registry";
import { readMapSnapshot } from "../lib/maps/store";
/** Dormant export path. It does not change any live map URL or enable a cron. */
async function main() {
  const folder = resolve("output/map-tiles");
  await mkdir(folder, { recursive: true });
  const lines: string[] = [];
  if (process.env.CASE_EXPORT_URL) {
    const base = new URL(process.env.CASE_EXPORT_URL);
    if (
      base.protocol !== "https:" ||
      base.hostname !== "www.localagendawatch.com"
    )
      throw Error("Use the official authenticated export URL");
    if (!process.env.CRON_SECRET)
      throw Error("CRON_SECRET is required for the export runner");
    let cursor = "";
    do {
      const url = new URL(base);
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url, {
        headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw Error("Case export HTTP " + response.status);
      const page = await response.json();
      for (const f of page.features) lines.push(JSON.stringify(f));
      cursor = page.nextCursor ?? "";
    } while (cursor);
  } else
    for (const a of Object.values(AREAS).filter((a) => a.status === "live")) {
      const snapshot = await readMapSnapshot(a.id, { includeFlum: false });
      for (const c of snapshot?.cases ?? [])
        if (c.geometry && !c.citywide)
          lines.push(
            JSON.stringify({
              type: "Feature",
              geometry: c.geometry,
              properties: {
                id: a.id + ":" + c.id,
                area: a.id,
                title: c.title,
                stage: c.stage,
                href: c.href,
              },
            }),
          );
    }
  if (!lines.length)
    throw Error("No cached case geometry available; refresh snapshots first");
  const content = lines.join("\n"),
    hash = createHash("sha256").update(content).digest("hex").slice(0, 16),
    json = resolve(folder, "cases.geojsonl"),
    tiles = resolve(folder, "cases-" + hash + ".pmtiles");
  await writeFile(json, content);
  console.log(
    JSON.stringify({
      features: lines.length,
      geojsonBytes: Buffer.byteLength(content),
      hash,
    }),
  );
  if (process.argv.includes("--dry-run")) return;
  const compiled = spawnSync(
    "tippecanoe",
    [
      "-P",
      "-Z",
      "0",
      "-z",
      "14",
      "--layer=cases",
      "--drop-densest-as-needed",
      "--force",
      "--output=" + tiles,
      json,
    ],
    { stdio: "inherit" },
  );
  if (compiled.error || compiled.status !== 0)
    throw Error(
      "Install current felt/tippecanoe with PMTiles output support to compile this export.",
    );
  if (process.argv.includes("--upload")) {
    const { list, put } = await import("@vercel/blob");
    const pathname = "map/cases-" + hash + ".pmtiles",
      existing = (await list({ prefix: pathname, limit: 1 })).blobs.find(
        (b) => b.pathname === pathname,
      );
    const result =
      existing ??
      (await put(pathname, createReadStream(tiles), {
        access: "public",
        multipart: true,
        addRandomSuffix: false,
        contentType: "application/vnd.pmtiles",
      }));
    await put(
      "map/manifest.json",
      JSON.stringify({
        url: result.url,
        hash,
        features: lines.length,
        generatedAt: new Date().toISOString(),
      }),
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      },
    );
    console.log("Public tile archive: " + result.url);
  }
  console.log("Export complete. The live map still uses the viewport API.");
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
