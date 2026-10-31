import {publicAreaEntries} from "../jurisdictions/generated-public";
import type {AreaDefinition} from "./registry";
export type {AreaDefinition} from "./registry";
export type PublicArea=Omit<AreaDefinition,"boundary"|"coverageBoundary"|"recordPage">&{color?:string};
export const AREAS:Record<string,PublicArea>=Object.fromEntries(publicAreaEntries.map(a=>[a.id,a as PublicArea]));
export const FEATURED_AREA_ID="nampa";
export function getArea(id:string){return Object.hasOwn(AREAS,id)?AREAS[id]:undefined;}
export function findArea(country:string,state:string,slug:string){return Object.values(AREAS).find(a=>a.country===country&&a.state===state&&a.slug===slug);}
export function areaPath(area:Pick<PublicArea,"country"|"state"|"slug">|string){const a=typeof area==="string"?getArea(area):area;return a?`/${a.country}/${a.state}/${a.slug}`:"/"+area;}
export function canonicalAreaHref(id:string,path:string){const a=getArea(id);if(!a)return path;const old="/"+id;return path===old||path.startsWith(old+"/")||path.startsWith(old+"?")||path.startsWith(old+"#")?areaPath(a)+path.slice(old.length):path;}
export function stageLabel(stage:string,area:Pick<PublicArea,"bodies">){return stage.startsWith("P&Z hearing")?area.bodies.planning.stageLabel+stage.slice("P&Z hearing".length):stage.startsWith("Council hearing")?area.bodies.decision.stageLabel+stage.slice("Council hearing".length):stage;}
export function mapStageLabel(stage:string,area?:Pick<PublicArea,"bodies">){return stage==="P&Z"?area?.bodies.planning.shortLabel??"Planning":stage==="Council/Board"?area?.bodies.decision.shortLabel??"Decision body":stage;}
