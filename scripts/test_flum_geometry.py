import json
import tempfile
import unittest
from pathlib import Path
from shapely.geometry import box, mapping, shape, Point
from flum_geometry import prepare


class PreparedLandUseTests(unittest.TestCase):
    def test_city_plan_extents_and_county_mask(self):
        def area(id, kind, boundary, plan):
            return {"id": id, "type": kind, "boundary": mapping(boundary), "features": [
                {"geometry": mapping(plan), "properties": {"area": id}}
            ]}
        areas = [area("city-a", "city", box(0, 0, 1, 1), box(0, 0, 3, 1)),
                 area("city-b", "city", box(2, 0, 3, 1), box(2, 0, 3, 1)),
                 area("county", "county", box(-1, 0, 4, 1), box(-1, 0, 4, 1))]
        with tempfile.TemporaryDirectory() as folder:
            source, target = Path(folder)/"source.json", Path(folder)/"result.json"
            source.write_text(json.dumps({"areas": areas}), encoding="utf-8")
            prepare(source, target)
            features = json.loads(target.read_text(encoding="utf-8"))["features"]
            def at(x):
                return [f["properties"]["area"] for f in features if shape(f["geometry"]).contains(Point(x, .5))]
            self.assertEqual(at(.5), ["city-a"])
            self.assertEqual(at(1.5), ["city-a"])  # Unannexed published city plan stays visible.
            self.assertEqual(at(2.5), ["city-b"])  # Actual other-city limits take precedence.
            self.assertEqual(at(3.5), ["county"])
