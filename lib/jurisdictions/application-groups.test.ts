import {expect,it} from "vitest";
import {groupApplications} from "./application-groups";
import {matchApplications} from "./matching";
import {jurisdiction} from "./registry";
import type {Application,AgendaItem} from "./adapters/types";
const app=(recordId:string,parcel="R1"):Application=>({recordId,relatedCaseNumbers:[],name:"Source proposal",type:"",status:"Active",address:"",parcel:[parcel],description:"Official proposal",received:"2021-01-01",recordUrl:"https://official.test/case",sourceUrl:"https://official.test",sourceFields:{APPFileNum:recordId.slice(0,9)},geometry:{type:"Polygon",coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}});
const item=(id:string)=>({title:"Official agenda proposal",caseNumbers:[id]}) as AgendaItem;
it.each([
 ["202601398",["CU","MSP"],"CU-MSP"],
 ["202601614",["VAC","PCON"],"VAC-PCON"],
 ["202601395",["ALT"],"CU-MSP-ALT"],
 ["202103209",["S","HD"],"S-TE"],
])("groups and links source components for %s",(number,suffixes,combined)=>{
 const grouped=groupApplications(jurisdiction("ada-county"),suffixes.map((s,i)=>app(number+"-"+s,"R"+i)));
 expect(grouped).toHaveLength(1);expect(grouped[0].projectNumber).toBe(number);
 expect(grouped[0].parcel).toHaveLength(suffixes.length);
 if(suffixes.length>1)expect(grouped[0].geometry?.type).toBe("MultiPolygon");
 expect(matchApplications(item(number+"-"+combined),grouped)).toEqual([{recordId:grouped[0].recordId,method:"case",sourceUrl:"https://official.test/case"}]);
 expect(matchApplications(item(number+"-ZC"),grouped)).toEqual([]);
});
it("does not group other jurisdictions or match different project numbers",()=>{
 expect(groupApplications(jurisdiction("boise"),[app("202601398-CU"),app("202601398-MSP")])).toHaveLength(2);
 const grouped=groupApplications(jurisdiction("ada-county"),[app("202601398-CU")]);
 expect(matchApplications(item("202601399-CU"),grouped)).toEqual([]);
});
it("preserves every source suffix, parcel and old received date independent of input ordering",()=>{
 const rows=[app("202601753-MSP","R2"),app("202601753-CU","R1"),app("202601753-HD","R3")];
 const grouped=groupApplications(jurisdiction("ada-county"),rows);
 expect(grouped).toEqual(groupApplications(jurisdiction("ada-county"),rows.toReversed()));
 expect(grouped[0].relatedCaseNumbers).toEqual(["202601753-HD","202601753-MSP"]);
 expect(grouped[0].received).toBe("2021-01-01");
});
