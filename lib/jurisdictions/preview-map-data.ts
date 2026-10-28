import {bbox,feature,featureCollection} from "@turf/turf";
import type {FeatureCollection,Geometry,Point} from "geojson";
import {polygonGeometry} from "../maps/gis";
import {geometryCentroid} from "../maps/spatial";
/** Only verified source polygons produce markers; unlocated cases stay in the list. */
export function previewMapData(boundaries:FeatureCollection,cases:FeatureCollection<Geometry|null>){
 const markers:FeatureCollection<Point>=featureCollection(cases.features.flatMap(f=>{
  if(!polygonGeometry(f.geometry))return[];
  const center=geometryCentroid(f.geometry! as Parameters<typeof geometryCentroid>[0]);
  if(!center.every(Number.isFinite))return[];
  return[feature({type:"Point" as const,coordinates:center},f.properties)];
 }));
 const extent=markers.features.length?markers:boundaries,values=extent.features.length?bbox(extent):undefined;
 const bounds=values?.every(Number.isFinite)?[[values[0],values[1]],[values[2],values[3]]] as [[number,number],[number,number]]:undefined;
 return{markers,bounds};
}
