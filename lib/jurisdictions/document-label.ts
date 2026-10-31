import type {Attachment} from "./adapters/types";
export function documentLabel(kind:Attachment["kind"]){
 return ({staff_report:"Staff report",agenda:"Agenda",findings:"Findings",memo:"Memo",minutes:"Minutes",packet:"Meeting packet",other:"Official attachment"})[kind];
}
