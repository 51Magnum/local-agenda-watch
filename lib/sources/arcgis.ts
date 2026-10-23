/**
 * Minimal client for Esri ArcGIS Feature / Map Service layers.
 *
 * Most city / county GIS portals expose their data here without auth:
 *   GET {baseUrl}/{layerId}/query?where=1=1&outFields=*&f=json
 *
 * Responses are wrapped in `{ features: [{ attributes, geometry }], exceededTransferLimit }`.
 * This client pages through `exceededTransferLimit` automatically and returns
 * a flat list of attributes (typed by the caller).
 */

export type ArcGISLayerConfig = {
  /** Service URL including the MapServer/FeatureServer path but not the layer id. */
  serviceUrl: string;
  /** Numeric layer id (e.g. 0 for the first layer in the service). */
  layerId: number;
};

export type ArcGISQueryOptions = {
  /** SQL-ish where clause. Default "1=1" (all records). */
  where?: string;
  /** Either an explicit list or "*". Default "*". */
  outFields?: string[] | "*";
  /** Return geometry alongside attributes. Default false (cheaper). */
  returnGeometry?: boolean;
  /** SQL order-by, e.g. "OBJECTID ASC". */
  orderByFields?: string;
  /** Per-page size; server caps at the layer's `maxRecordCount` (commonly 1000-2000). */
  pageSize?: number;
  /** Seconds before Next.js revalidates. Default 1800 (30 min). */
  revalidate?: number;
  /** Optional cache tag. */
  tag?: string;
};

type Feature<TAttrs> = {
  attributes: TAttrs;
  geometry?: unknown;
};

type QueryResponse<TAttrs> = {
  features: Feature<TAttrs>[];
  exceededTransferLimit?: boolean;
  error?: { code: number; message: string };
};

export async function queryFeatures<TAttrs>(
  layer: ArcGISLayerConfig,
  options: ArcGISQueryOptions = {}
): Promise<TAttrs[]> {
  const {
    where = "1=1",
    outFields = "*",
    returnGeometry = false,
    orderByFields,
    pageSize = 2000,
    revalidate = 1800,
    tag,
  } = options;

  const baseParams: Record<string, string> = {
    where,
    outFields: Array.isArray(outFields) ? outFields.join(",") : outFields,
    returnGeometry: returnGeometry ? "true" : "false",
    f: "json",
    resultRecordCount: String(pageSize),
  };
  if (orderByFields) baseParams.orderByFields = orderByFields;

  const endpoint = `${layer.serviceUrl.replace(/\/+$/, "")}/${layer.layerId}/query`;
  const results: TAttrs[] = [];
  let offset = 0;
  // Hard cap to avoid pathological infinite loops; 10 pages * 2000 = 20k features.
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ ...baseParams, resultOffset: String(offset) });
    const res = await fetch(`${endpoint}?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
      next: {
        revalidate,
        ...(tag ? { tags: [tag] } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`ArcGIS ${res.status} on ${endpoint}`);
    }
    const body = (await res.json()) as QueryResponse<TAttrs>;
    if (body.error) {
      throw new Error(`ArcGIS error ${body.error.code}: ${body.error.message}`);
    }
    for (const f of body.features ?? []) results.push(f.attributes);
    if (!body.exceededTransferLimit) break;
    offset += pageSize;
  }
  return results;
}

/**
 * Convenience helper for fetching a single feature by primary-key equality.
 * Returns null if no match. Values are wrapped in single quotes; pass already-
 * escaped input if the field can contain apostrophes.
 */
export async function queryFeatureByField<TAttrs>(
  layer: ArcGISLayerConfig,
  field: string,
  value: string,
  options: Omit<ArcGISQueryOptions, "where"> = {}
): Promise<TAttrs | null> {
  const escaped = value.replace(/'/g, "''");
  const rows = await queryFeatures<TAttrs>(layer, {
    ...options,
    where: `${field} = '${escaped}'`,
  });
  return rows[0] ?? null;
}
