import type { PaneData } from "../../lib/maps/project-questions";
import type { Hearing } from "../../lib/localities/types";
/** Synthetic regression records modeled on reported errors, never production seed data. */
export function alertFixture(name="Momentum Subdivision",caseId="H-2026-0036",areaId="meridian"):PaneData {
  const summary="Subdivision with 11 Residential and 24 Commercial Lots on 106.1 Acres";
  return {area:{id:areaId,name:"City of "+areaId[0].toUpperCase()+areaId.slice(1),timezone:"America/Denver",planningBody:"Planning & Zoning Commission",decisionBody:"City Council"},
    item:{id:caseId,areaId,title:name,type:"PP",typeLabel:"Preliminary plat",summary,stage:"In review",recordStatus:"Pending",href:`/us/id/${areaId}/plan/${caseId}`,geometry:null,centroid:[-116.4,43.56],confidence:"exact",source:"polygon",citywide:false,flumCategories:[],uses:["homes","business"],popup:{projectName:name,headline:summary,explanation:summary,progress:[]}},
    caseIds:[caseId],where:"northeast corner of Example Road and Sample Avenue",history:[],conditions:[],impacts:[{label:"Proposed density",value:"~0.1 homes/acre",url:"https://official.example.test/report.pdf"}],
    lastHearing:"2026-11-05",next:{body:"Planning & Zoning Commission",startsAt:"2026-11-05",location:"City Hall",role:"Decision-making body",sourceUrl:"https://official.example.test/hearing",commentDeadline:"2026-11-04",commentSourceUrl:"https://official.example.test/comments"},
    commentInstructions:"Sign up to speak. Submit exhibits by the posted deadline.",commentUrl:"https://official.example.test/comments",officialRecords:[{label:"Case record",url:`https://official.example.test/project/${caseId}`}],documents:[],updatedAt:"2026-11-06"};
}
export function hearingFixture(id:string,extra:Partial<Hearing>={}):Hearing {
  return {appId:id,appType:id.split("-")[0],appTypeLabel:"Preliminary plat",appStatus:"Pending",appPhase:"Review",appPhaseRaw:"Review",appScope:"Nineteenth Subdivision",appAcres:null,externalUrl:"https://official.example.test/project/"+id,energovPlanId:null,meetings:[],...extra};
}
