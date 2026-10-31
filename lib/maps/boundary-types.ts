import type {FeatureCollection,Polygon,MultiPolygon,Point} from "geojson";
export type BoundaryArea={id:string;name:string;type:"city"|"county";status:"live";color:string;href:string};
export type BoundaryPayload={version:string;polygons:FeatureCollection<Polygon|MultiPolygon,BoundaryArea>;labels:FeatureCollection<Point>;uncovered:FeatureCollection<Polygon|MultiPolygon>};
