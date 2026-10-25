import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { booleanPointInPolygon, point } from "@turf/turf";
import type { Polygon, MultiPolygon } from "geojson";
import manifest from "@/public/flum/manifest.json";

it("serves the prepared archive through bounded range reads, preserving the Braeburn designation and provenance", async () => {
  const file = await readFile("public" + manifest.url);
  const reads: { offset: number; length: number }[] = [];
  const archive = new PMTiles({
    getKey: () => manifest.hash,
    getBytes: async (offset, length) => {
      reads.push({ offset, length });
      const bytes = file.subarray(
        offset,
        Math.min(file.length, offset + length),
      );
      return {
        data: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      };
    },
  });
  const header = await archive.getHeader();
  expect(header.maxZoom).toBe(14);
  expect(header.numAddressedTiles).toBe(manifest.tiles);
  const lng = -116.508,
    lat = 43.565,
    z = 12,
    x = Math.floor(((lng + 180) / 360) * 2 ** z),
    y = Math.floor(
      ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) *
        2 ** z,
    );
  const response = await archive.getZxy(z, x, y);
  expect(response).toBeDefined();
  const layer = new VectorTile(new PbfReader(new Uint8Array(response!.data)))
    .layers.flum;
  const matches = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i),
      g = f.toGeoJSON(x, y, z);
    if (
      booleanPointInPolygon(
        point([lng, lat]),
        g.geometry as Polygon | MultiPolygon,
      )
    )
      matches.push(f.properties);
  }
  expect(
    matches.some((p) => p.area === "nampa" && p.group === "Residential med"),
  ).toBe(true);
  expect(matches.some((p) => p.area === "canyon-county")).toBe(false);
  expect(matches[0].jurisdiction).toBe("City of Nampa");
  expect(matches[0].source).toMatch(/^https:/);
  expect(reads.every((r) => r.length < file.length)).toBe(true);
  expect(reads.reduce((n, r) => n + r.length, 0)).toBeLessThan(200000);
});
