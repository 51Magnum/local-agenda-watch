import {legacyCoverageAreas} from "../lib/areas/registry";
import {buildAreaBoundaries} from "../lib/maps/area-boundaries";
import {mkdir,writeFile} from "node:fs/promises";
async function write(){await mkdir("public/map-data",{recursive:true});await writeFile("public/map-data/boundaries.json",JSON.stringify(buildAreaBoundaries(legacyCoverageAreas())));}
void write().catch(error=>{console.error(error);process.exitCode=1;});
