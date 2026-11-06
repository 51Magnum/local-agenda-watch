import type {JurisdictionDefinition} from "./types";
const privateField=/applicant|owner|staff|planner|contact|email|phone|recordname/i;
/** Explicit source projection, never inferred from a missing applicant mapping. */
export function publicApplicationFields(d:JurisdictionDefinition):string[]|undefined{
 const fields=d.applications.params.publicFields;
 if(fields===undefined)return;
 if(!Array.isArray(fields)||!fields.length||fields.some(f=>typeof f!=="string"||!/^\w+$/.test(f)||privateField.test(f)))throw Error("Public application fields must be explicit non-personal source columns");
 const mapping=d.applications.params.fields as Record<string,string>;
 if([mapping.id,mapping.description,mapping.type].some(f=>!fields.includes(f)))throw Error("Public field projection must include identity, description and type");
 return fields;
}
export function hasPublicFieldProjection(d:JurisdictionDefinition,source:Record<string,unknown>){
 const fields=publicApplicationFields(d);return !!fields&&Object.keys(source).length>0&&Object.keys(source).every(k=>fields.includes(k))&&typeof source[(d.applications.params.fields as Record<string,string>).id]==="string";
}
