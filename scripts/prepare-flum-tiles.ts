import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { GeoJSONVT } from "@maplibre/geojson-vt";
import { fromGeojsonVt } from "@maplibre/vt-pbf";
import { bbox } from "@turf/turf";
import { publishedFlumAreas } from "../lib/maps/flum-areas";
import { fetchFlum } from "../lib/maps/refresh";
import { jurisdiction } from "../lib/jurisdictions/registry";
import { getJurisdiction } from "../lib/maps/jurisdictions";
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
async function source(id:string):Promise<FlumCache>{
 const config=getJurisdiction(id);if(!config?.flum.layerUrl)throw Error("No official FLUM source for "+id);
 return fetchFlum(config);
}
async function main() {
  await mkdir(work, { recursive: true });
  await mkdir(destination, { recursive: true });
  const response=await fetch("https://www.localagendawatch.com/api/map/meta",{cache:"no-store",signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error("Published area metadata unavailable; preserve existing tiles");
  const metadata=await response.json();
  if(!Array.isArray(metadata.areas)||!metadata.areas.length)throw Error("Published area metadata is empty");
  const preparedSnapshots:Record<string,FlumCache>={};
  const areas = [],
    dates: Record<string, string> = {};
  for (const area of publishedFlumAreas(metadata.areas.map((a:{id:string})=>a.id)).filter((a) => a.status === "live")) {
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
    if(!jurisdiction(area.id)?.legacyPublic)preparedSnapshots[area.id]=data;
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
  // Client maps need tile/style metadata, never the jurisdiction directory.
  await writeFile(join(destination,"client-manifest.json"),JSON.stringify(Object.fromEntries(Object.entries(manifest).filter(([key])=>key!=="sourceDates")),null,2)+"\n");
  // Server maps and zero-DB previews use the same verified public source as the tiles.
  await mkdir("data/flum",{recursive:true});
  for(const [id,data] of Object.entries(preparedSnapshots))await writeFile("data/flum/"+id+".json",JSON.stringify(data)+"\n");
  await writeFile("lib/maps/prepared-flum.ts",'import "server-only";\nimport type {FlumCache} from "./types";\n'+Object.keys(preparedSnapshots).map((id,i)=>'import source'+i+' from "../../data/flum/'+id+'.json";').join("\n")+'\nconst snapshots:Record<string,FlumCache>={'+Object.keys(preparedSnapshots).map((id,i)=>JSON.stringify(id)+':source'+i+' as FlumCache').join(',')+'};\nexport function preparedFlumSnapshot(id:string):FlumCache|undefined{return snapshots[id]?structuredClone(snapshots[id]):undefined;}\n');
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
