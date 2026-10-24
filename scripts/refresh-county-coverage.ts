/** Refresh this public-data coverage asset when city limits change. */
import { readFile, writeFile } from "node:fs/promises";
import { difference, feature, featureCollection } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { geoQuery } from "../lib/maps/gis";
import { COUNTY_CITY_LIMITS } from "../lib/sources/canyon-county";
async function main(){
 const boundary=JSON.parse(await readFile("lib/areas/boundaries/canyon-county.json","utf8")) as MultiPolygon;
 const cities=await geoQuery(COUNTY_CITY_LIMITS);
 let remaining:Feature<Polygon|MultiPolygon>=feature(boundary);
 for(const city of cities.features){
  if(city.geometry?.type!=="Polygon"&&city.geometry?.type!=="MultiPolygon")throw new Error("Invalid city-limit geometry");
  const cut=difference(featureCollection([remaining,city as Feature<Polygon|MultiPolygon>]));
  if(!cut)throw new Error("City limits removed the entire County; refusing to overwrite coverage");
  remaining=cut;
 }
 await writeFile("lib/areas/boundaries/canyon-county-jurisdiction.json",JSON.stringify(remaining.geometry));
 console.log("Updated County land-use coverage using "+cities.features.length+" incorporated city boundaries.");
}
main().catch(()=>{console.error("County coverage refresh failed; verify official city-limit sources.");process.exitCode=1;});
