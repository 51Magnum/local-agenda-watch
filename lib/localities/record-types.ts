export type RecordDocument={label:string;filename:string;url:string;sourceUrl:string};
export type RecordEvent={id:string;caseIds:string[];name:string;address:string;body:string;date:string;time?:string;startsAt:string;deadline?:string;result?:string;note?:string;sourceUrl:string;documents:RecordDocument[];linkedIds:string[];countywide?:boolean};
export type PublicCaseRecord={sourceUrl?:string;appliedDate?:string;reviewDate?:string;decisionDate?:string;address:string;events:RecordEvent[];sourceStatus:string;approvalStatus:string;documents?:RecordDocument[]};
