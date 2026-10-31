import {visibleAreas} from "@/lib/areas/registry";
import { unstable_cache } from "next/cache";

import { getJurisdiction } from "./jurisdictions";
import { readFlumSnapshot } from "./store";
import { clipCombinedFlum } from "./radius";
import type { Bounds } from "./viewport";

/** Cache the expensive merged viewport, invalidated when published plan data changes. */
export const combinedFlumViewport = unstable_cache(
  async (bounds: Bounds) => {
    const warnings: string[] = [];
    const areas = (await visibleAreas()).filter(
      (a) => a.status === "live" && getJurisdiction(a.id)?.flum.layerUrl,
    );
    const layers = await Promise.all(
      areas.map(async (area) => {
        const config = getJurisdiction(area.id)!;
        try {
          const data = await readFlumSnapshot(area.id, { bounds });
          if (data)
            return {
              area,
              flum: data,
              categoryField: config.flum.categoryField,
            };
        } catch {}
        warnings.push(area.name + " future land use unavailable.");
      }),
    );
    const data = clipCombinedFlum(
      layers.filter((l) => l !== undefined),
      (await visibleAreas()).filter((a) => a.type === "city"),
      [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
      1,
      bounds,
    );
    return { ...data, warnings };
  },
  ["combined-flum-viewport-v1"],
  { revalidate: 3600, tags: ["map-flum"] },
);
