import type {Attachment} from "./adapters/types";
export function documentLabel(kind:Attachment["kind"]){
 return ({staff_report:"Staff report",report:"Report",agenda:"Agenda",findings:"Findings",memo:"Memo",tabling_memo:"Tabling memo",notice:"Notice",application:"Application",narrative:"Applicant narrative",letter:"Letter",public_comment:"Public comment",minutes:"Minutes",packet:"Meeting packet",other:"Official attachment"})[kind];
}
