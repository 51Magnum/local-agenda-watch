import {expect,it} from "vitest";
import {matchApplications} from "./matching";
import type {AgendaItem,Application} from "./adapters/types";
const app={recordId:"PLN26-00001",relatedCaseNumbers:["CAR26-00013"],recordUrl:"https://official.test/1",parcel:["R123456"],address:"123 Main Street"} as Application;
const item=(title:string,caseNumbers:string[]=[])=>({title,caseNumbers}) as AgendaItem;
it("uses explicit child IDs before unique parcel or full-address fallbacks",()=>{
 expect(matchApplications(item("123 Main Street",["CAR26-00013"]),[app])[0].method).toBe("case");
 expect(matchApplications(item("Parcel R123456"),[app])[0].method).toBe("parcel");
 expect(matchApplications(item("Proposal at 123 Main Street"),[app])[0].method).toBe("address");
 expect(matchApplications(item("123 Main Street"),[app,{...app,recordId:"other"}])).toEqual([]);
 expect(matchApplications(item("A similar street name"),[app])).toEqual([]);
});
