import{caseCatalog}from"@/lib/case-catalog";
import{getCaseNextHearing,caseDisplayTitle,cleanCaseType,caseProjectName}from"@/lib/case-details";
import{latestCouncilDecision}from"@/lib/localities/stages";
import{projectPathForCase,getProjectForCase}from"@/lib/projects";
import{areaPath,type AreaDefinition}from"./registry";
import type{HearingFeed}from"../localities/types";
export type HomeHearing={id:string;title:string;summary:string;startsAt:string;body:string;href:string;commentUrl?:string};
export type HomeDecision={id:string;title:string;outcome:string;date?:string;href:string;sourceUrl?:string};
export type HomeAreaData={id:string;hearings:HomeHearing[];decisions:HomeDecision[]};
export function homeAreaData(area:AreaDefinition,feed:HearingFeed):HomeAreaData{
  const cases=caseCatalog(feed);const hearings=new Map<string,HomeHearing>();
  for(const h of cases){const next=getCaseNextHearing(h,feed,new Date(),area.id);if(!next)continue;const href=areaPath(area)+projectPathForCase(h.appId,area.id),key=href+next.startsAt;hearings.set(key,{id:h.appId,title:getProjectForCase(h.appId,area.id)?.name??caseDisplayTitle(h),summary:getProjectForCase(h.appId,area.id)?.summary??[cleanCaseType(h.appTypeLabel),h.appAcres!=null?h.appAcres.toLocaleString("en-US",{maximumFractionDigits:2})+" acres":undefined].filter(Boolean).join(" · "),startsAt:next.startsAt,body:next.body,href,commentUrl:area.commentInstructionsUrl});}
  const decisions=new Map<string,HomeDecision>();
  for(const h of cases){const result=latestCouncilDecision(h);const outcome=result?.result??(/^(approved|denied)$/i.test(h.appStatus)?h.appStatus:undefined);if(!outcome)continue;const name=caseProjectName(h),key=(name??h.appId)+outcome;const item={id:h.appId,title:caseDisplayTitle(h),outcome:/^approved/i.test(outcome)?"Approved":"Denied",date:result?.date,sourceUrl:result?.sourceUrl??h.externalUrl??undefined,href:areaPath(area)+projectPathForCase(h.appId,area.id)};const prior=decisions.get(key);if(!prior||(item.date??"")>(prior.date??""))decisions.set(key,item);}
  return{id:area.id,hearings:[...hearings.values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).slice(0,4),decisions:[...decisions.values()].sort((a,b)=>(b.date??"").localeCompare(a.date??"")).slice(0,3)};
}
