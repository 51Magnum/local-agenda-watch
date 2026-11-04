import {isLonLat} from "./types";
export type SavedMapPin={id:string;label:string;coordinates:[number,number];radiusMiles:number;alertsEnabled:boolean};
export function parseSavedMapPins(value:unknown):SavedMapPin[]{
 if(!value||typeof value!=="object"||!Array.isArray((value as {pins?:unknown}).pins))throw Error("Saved pins unavailable");
 return (value as {pins:unknown[]}).pins.map(value=>{
  const p=value as SavedMapPin;
  if(!p||typeof p.id!=="string"||typeof p.label!=="string"||p.label.length>300||!isLonLat(p.coordinates)||!Number.isFinite(p.radiusMiles)||p.radiusMiles<.25||p.radiusMiles>10)throw Error("Invalid saved pin");
  return {id:p.id,label:p.label,coordinates:p.coordinates,radiusMiles:p.radiusMiles,alertsEnabled:p.alertsEnabled===true};
 });
}
