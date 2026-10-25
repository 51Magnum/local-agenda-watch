"""Offline topology work and archive packing. Never invoked by a map request."""
import json
import sys
from pathlib import Path
from shapely import make_valid
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union
from shapely.prepared import prep


def polygonal(g):
    if g.is_empty:
        return None
    if isinstance(g, (Polygon, MultiPolygon)):
        return g
    parts = [p for p in getattr(g, "geoms", []) if isinstance(p, (Polygon, MultiPolygon))]
    return unary_union(parts) if parts else None


def prepare(source, target):
    data = json.loads(Path(source).read_text(encoding="utf-8"))
    limits = {a["id"]: make_valid(shape(a["boundary"])) for a in data["areas"] if a["type"] == "city"}
    features, counties, masks = [], [], []
    counts = {}
    for a in data["areas"]:
        count = 0
        other_limits = unary_union([g for k, g in limits.items() if k != a["id"]]) if a["type"] == "city" else None
        for f in a["features"]:
            g = polygonal(make_valid(shape(f["geometry"])))
            if g is None:
                continue
            # Preserve published city planning extents outside city limits.
            # A city's own planning colors do not replace another city's limits.
            if other_limits is not None and g.intersects(other_limits):
                g = polygonal(g.difference(other_limits))
            if g is None or g.is_empty:
                continue
            item = (g, f["properties"])
            if a["type"] == "city":
                features.append(item)
                masks.append(g)
            else:
                counties.append(item)
            count += 1
        counts[a["id"]] = count
    # Dissolve city footprints ONCE; county polygons do not repeatedly subtract
    # thousands of individual category polygons while a resident waits.
    city_mask = unary_union(masks)
    prepared_mask = prep(city_mask)
    for g, properties in counties:
        if prepared_mask.intersects(g):
            g = polygonal(g.difference(city_mask))
        if g is not None and not g.is_empty:
            features.append((g, properties))
    output = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": mapping(g), "properties": p} for g, p in features
    ]}
    Path(target).write_text(json.dumps(output, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"preparedFeatures": len(features), "perArea": counts}), flush=True)


def pack(folder, target):
    from pmtiles.writer import Writer
    from pmtiles.tile import Compression, TileType, zxy_to_tileid
    folder = Path(folder)
    metadata = json.loads((folder / "metadata.json").read_text(encoding="utf-8"))
    tiles = []
    for p in folder.glob("*.pbf"):
        z, x, y = map(int, p.stem.split("-"))
        tiles.append((zxy_to_tileid(z, x, y), p))
    if not tiles:
        raise RuntimeError("No land-use tiles generated")
    b = metadata["bounds"]
    with open(target, "wb") as f:
        writer = Writer(f)
        for tile_id, p in sorted(tiles):
            writer.write_tile(tile_id, p.read_bytes())
        writer.finalize({
            "tile_type": TileType.MVT, "tile_compression": Compression.GZIP,
            "min_lon_e7": round(b[0] * 1e7), "min_lat_e7": round(b[1] * 1e7),
            "max_lon_e7": round(b[2] * 1e7), "max_lat_e7": round(b[3] * 1e7),
            "center_lon_e7": round((b[0]+b[2])/2 * 1e7),
            "center_lat_e7": round((b[1]+b[3])/2 * 1e7), "center_zoom": 10,
        }, metadata)
    print(json.dumps({"tiles": len(tiles), "archiveBytes": Path(target).stat().st_size}), flush=True)


if __name__ == "__main__":
    {"prepare": prepare, "pack": pack}[sys.argv[1]](*sys.argv[2:])
