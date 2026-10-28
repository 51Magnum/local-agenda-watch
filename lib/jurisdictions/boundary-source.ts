import type {FeatureCollection,Geometry} from "geojson";
import type {JurisdictionDefinition,LayerSource} from "./types";
import type {StagingSnapshot} from "./store";
import type {CaseGeometry} from "../maps/types";
import {registryBoundaries} from "./generated";
export function verifyBoundarySource(source:LayerSource,data:FeatureCollection<Geometry|null>){
 if(source.expectedFeatureCount!==undefined&&data.features.length!==source.expectedFeatureCount)throw Error("Boundary source returned an unexpected feature count");
 for(const f of data.features)for(const [key,value]of Object.entries(source.expectedProperties??{}))if(f.properties?.[key]!==value)throw Error("Boundary source identity does not match "+key);
}
export function boundarySourceMatches(d:JurisdictionDefinition,snapshot:StagingSnapshot){return snapshot.boundarySource?.url===d.boundary.url&&snapshot.boundarySource?.where===d.boundary.where;}
export function collectionCoverage(d:JurisdictionDefinition,snapshot:StagingSnapshot):CaseGeometry|undefined{
 return boundarySourceMatches(d,snapshot)?snapshot.coverageBoundary:registryBoundaries[d.id+":coverageBoundary"] as CaseGeometry|undefined;
}
