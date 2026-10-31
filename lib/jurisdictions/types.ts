import type {AreaDefinition} from "../areas/registry";
export type LaunchStatus = "draft" | "qa" | "admin_only" | "public";
export type AgendaPlatform = "primegov" | "iqm2" | "escribe" | "adaFileBrowse" | "municipalClerk" | "countyLandHearings" | "civicplusArchive" | "municodePublishPage" | "sanityNotices" | "granicusPublisher";
export type LayerSource = {expectedFeatureCount?:number;expectedProperties?:Record<string,string|number>;source:"arcgis";url:string;where:string;outSR:4326};
export type HearingBody = {key:string;name:string;role:"recommending"|"deciding"|"design"|"quasi-judicial";agendaBodyMatch:string};
export type AgendaSource = {adapter:AgendaPlatform;params:Record<string,unknown>;bodies:string[];activeFrom?:string;activeUntil?:string;bodyWindows?:Record<string,{activeFrom?:string;activeUntil?:string}>};
export type DeadlineRule = {kind:"written"|"signup"|"remote";rule:string;bodyKeys?:string[];sourceUrl:string;timeVerified?:boolean};
export type JurisdictionDefinition = {
 id:string;name:string;type:"city"|"county";state:string;timezone:string;color:string;mapOrder:number;catalogOrder?:number;
 boundary:LayerSource;impactArea?:LayerSource;clipRule?:{operation:"subtractCityLimits";layer:LayerSource};
 agenda:AgendaSource[];
 applications:{adapter:"arcgisFeatureLayer"|"accelaAca"|"none";params:Record<string,unknown>;recordUrlTemplate?:string};
 gis:Partial<Record<"parcels"|"zoning"|"futureLandUse"|"cityLimits"|"impactAreas"|"countyBoundary",string>>;
 hearingBodies:HearingBody[];caseNumberPatterns:string[];
 participation:{hearingsUrl?:string;legalNoticesUrl?:string;testimonySignupUrl?:string;signupUrlRule?:string;signupEventsUrl?:string;writtenCommentEmails?:Record<string,string[]>;deadlineRules:DeadlineRule[]};
 costCaps:{backfillUsd:number;monthlyUsd:number;perDocMaxTokens:number};
 documents:{maxNativeBytes?:number;maxBytes:number;maxPages:number;allowPackets:false};
 enabled:boolean;launchStatus:LaunchStatus;sourcesVerifiedAt:string|null;notes:string[];
 legacyPublic?:boolean;publication?:{approvalId:string;qaHash:string};
 selfCheck?:{minPassRate?:number;mustInclude?:string[];typeOrder?:string[];fixtures?:{calendar:string;meeting:string;start:string;end:string}};
 /** Compatibility facts are moved, not copied, from the original area registry. */
 cachedBoundaryFile?:string;cachedCoverageBoundaryFile?:string;
 area:Omit<AreaDefinition,"id"|"slug"|"name"|"type"|"state"|"timezone"|"status"|"recordPage"|"boundary"|"coverageBoundary">;
 legacyMunicipal?:Record<string,unknown>;
 legacyRuntime?:Record<string,unknown>;recordPageHosts?:string[];
};
export function inSourceWindow(source:AgendaSource,body:string,date:string) {
 const window=source.bodyWindows?.[body]??source;
 return (!window.activeFrom||date>=window.activeFrom)&&(!window.activeUntil||date<=window.activeUntil);
}
