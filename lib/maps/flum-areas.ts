import "server-only";
import type {AreaDefinition} from "../areas/registry";
import {getArea} from "../areas/registry";
import {jurisdiction} from "../jurisdictions/registry";
import {readReviewSnapshot} from "../jurisdictions/review-snapshot";
/** Tile preparation includes only IDs confirmed public by the resident metadata endpoint. */
export function publishedFlumAreas(ids:readonly string[]){
 return [...new Set(ids)].flatMap(id=>{const d=jurisdiction(id);if(!d?.enabled)return [];const area=d.legacyPublic?getArea(id):readReviewSnapshot(id)?.area;return area?[area]:[];});
}

/** Disabled onboarding fixtures must never mask a real jurisdiction's plan. */
export function enabledPlanningAreas(areas:readonly AreaDefinition[]){return areas.filter(a=>jurisdiction(a.id)?.enabled);}
