/** Compatibility export; all values originate in one jurisdiction registry file. */
import {municipalIds,municipalSources} from "../jurisdictions/generated";
export type MunicipalId=typeof municipalIds[number];
type MunicipalSource={name:string;center:[number,number];bounds:[number,number,number,number];cases:string;caseField:string;nameField:string;statusField:string;tracker:string;agendas:string;comments:string;location:string;boundary:string;flum:string;flumField:string;flumLabel:string;flumSource:string};
export const MUNICIPAL_SOURCES=municipalSources as unknown as Record<MunicipalId,MunicipalSource>;
export const MUNICIPAL_IDS=[...municipalIds];
export const KUNA_CASES=MUNICIPAL_SOURCES.kuna.cases;
export const EAGLE_CASES=MUNICIPAL_SOURCES.eagle.cases;
