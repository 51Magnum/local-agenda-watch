import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { GeoJSONVT } from "@maplibre/geojson-vt";
import { fromGeojsonVt } from "@maplibre/vt-pbf";
import { bbox } from "@turf/turf";
import { AREAS } from "../lib/areas/registry";
import { getJurisdiction } from "../lib/maps/jurisdictions";
import { readFlumSnapshot } from "../lib/maps/store";
import { COMMON_FLUM, flumGroup } from "../lib/maps/radius";
import type { FlumCache } from "../lib/maps/types";
import type { FeatureCollection } from "geojson";

const work = resolve("output/flum-build"),
  destination = resolve("public/flum");
function python(...args: string[]) {
  const result = spawnSync(
    process.env.PYTHON ?? "python",
    ["scripts/flum_geometry.py", ...args],
    { stdio: "inherit", env: process.env },
  );
  if (result.error || result.status !== 0)
    throw Error(
      "Offline FLUM preparation failed; keep the last published archive. Install scripts/flum-requirements.txt first.",
    );
}
async function source(id: string): Promise<FlumCache | undefined> {
  if (!process.env.FLUM_EXPORT_URL) return readFlumSnapshot(id);
  const base = new URL(process.env.FLUM_EXPORT_URL);
  if (
    base.protocol !== "https:" ||
    base.hostname !== "www.localagendawatch.com" ||
    !process.env.CRON_SECRET
  )
    throw Error("Use the official authenticated FLUM export endpoint");
  let offset = 0;
  let result: FlumCache | undefined;
  do {
    const url = new URL(base);
    url.searchParams.set("area", id);
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + process.env.CRON_SECRET },
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw Error(id + " FLUM export HTTP " + response.status);
    const page = await response.json();
    result ??= {
      updatedAt: page.updatedAt,
      legend: page.legend,
      geojson: { type: "FeatureCollection", features: [] },
    };
    result.geojson.features.push(...page.features);
    offset = page.nextOffset ?? 0;
  } while (offset);
  return result;
}
async function main() {
  await mkdir(work, { recursive: true });
  await mkdir(destination, { recursive: true });
  const areas = [],
    dates: Record<string, string> = {};
  for (const area of Object.values(AREAS).filter((a) => a.status === "live")) {
    const config = getJurisdiction(area.id);
    if (!config?.flum.layerUrl) continue;
    const data = await source(area.id);
    if (!data?.geojson.features.length)
      throw Error(
        "No cached FLUM for " +
          area.id +
          "; preserve the previous published map",
      );
    dates[area.id] = data.updatedAt;
    areas.push({
      id: area.id,
      type: area.type,
      boundary: area.boundary,
      features: data.geojson.features.map((f) => {
        const category = String(
            f.properties?.[config.flum.categoryField] ?? "Unknown",
          ),
          label =
            data.legend.find((l) => l.value === category)?.label ?? category,
          group = flumGroup(label);
        return {
          type: "Feature",
          geometry: f.geometry,
          properties: {
            category: label,
            group,
            color: COMMON_FLUM[group],
            area: area.id,
            jurisdiction: (area.type === "city" ? "City of " : "") + area.name,
            plan: config.flum.label,
            source: config.flum.adoptionSource,
            updatedAt: data.updatedAt,
          },
        };
      }),
    });
  }
  if (!areas.length) throw Error("No FLUM source layers");
  const input = JSON.stringify({ areas }),
    hash = createHash("sha256")
      .update("flum-tiles-v1\n" + input)
      .digest("hex")
      .slice(0, 16);
  const archive = "flum-" + hash + ".pmtiles";
  let previous: { url?: string; hash?: string } | undefined;
  try {
    previous = JSON.parse(
      await readFile(join(destination, "manifest.json"), "utf8"),
    );
  } catch {}
  if (previous?.hash === hash) {
    console.log("FLUM sources unchanged; retain published tiles.");
    return;
  }
  const inputFile = join(work, "sources.json"),
    prepared = join(work, "prepared.geojson"),
    tileFolder = join(work, "tiles-" + hash);
  await writeFile(inputFile, input);
  python("prepare", inputFile, prepared);
  const data = JSON.parse(
    await readFile(prepared, "utf8"),
  ) as FeatureCollection;
  const bounds = bbox(data).slice(0, 4),
    index = new GeoJSONVT(data, {
      maxZoom: 14,
      indexMaxZoom: 6,
      tolerance: 2,
      extent: 4096,
      buffer: 64,
    });
  await mkdir(tileFolder, { recursive: true });
  const tx = (lng: number, z: number) =>
      Math.floor(((lng + 180) / 360) * 2 ** z),
    ty = (lat: number, z: number) =>
      Math.floor(
        ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) *
          2 ** z,
      );
  let count = 0,
    maxBytes = 0;
  for (let z = 5; z <= 14; z++)
    for (let x = tx(bounds[0], z); x <= tx(bounds[2], z); x++)
      for (let y = ty(bounds[3], z); y <= ty(bounds[1], z); y++) {
        const tile = index.getTile(z, x, y);
        if (!tile?.features.length) continue;
        const bytes = gzipSync(fromGeojsonVt({ flum: tile }), { level: 9 });
        maxBytes = Math.max(maxBytes, bytes.length);
        await writeFile(join(tileFolder, `${z}-${x}-${y}.pbf`), bytes);
        count++;
      }
  const fields = {
    category: "String",
    group: "String",
    color: "String",
    area: "String",
    jurisdiction: "String",
    plan: "String",
    source: "String",
    updatedAt: "String",
  };
  await writeFile(
    join(tileFolder, "metadata.json"),
    JSON.stringify({
      name: "Local Agenda Watch Future Land Use",
      bounds,
      minzoom: 5,
      maxzoom: 14,
      vector_layers: [{ id: "flum", fields, minzoom: 5, maxzoom: 14 }],
    }),
  );
  python("pack", tileFolder, join(destination, archive));
  const manifest = {
    version: 1,
    hash,
    url: "/flum/" + archive,
    sourceLayer: "flum",
    bounds,
    minZoom: 5,
    maxZoom: 14,
    updatedAt: Object.values(dates).sort()[0],
    sourceDates: dates,
    features: data.features.length,
    tiles: count,
    maxTileBytes: maxBytes,
    legend: Object.entries(COMMON_FLUM).map(([value, color]) => ({
      value,
      label: value,
      color,
    })),
  };
  await writeFile(
    join(destination, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  // Retain the previous archive for maps already open during an update.
  // Only remove older generated archives in this exact output directory.
  for (const name of await readdir(destination))
    if (
      /^flum-[a-f0-9]{16}\.pmtiles$/.test(name) &&
      name !== archive &&
      "/flum/" + name !== previous?.url
    )
      await unlink(join(destination, name));
  console.log(
    JSON.stringify({
      hash,
      features: data.features.length,
      tiles: count,
      maxTileBytes: maxBytes,
    }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
