import { mkdir, writeFile } from "node:fs/promises";
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
    const cli = process.platform === "win32" ? "vercel.cmd" : "vercel";
    const uploaded = spawnSync(
      cli,
      [
        "blob",
        "put",
        tiles,
        "--access",
        "public",
        "--pathname",
        "map/cases-" + hash + ".pmtiles",
        "--content-type",
        "application/vnd.pmtiles",
      ],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    if (uploaded.error || uploaded.status !== 0)
      throw Error(
        "Blob upload failed. Configure the export runner's Blob access; never put tokens in command arguments.",
      );
  }
  console.log("Export complete. The live map still uses the viewport API.");
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
