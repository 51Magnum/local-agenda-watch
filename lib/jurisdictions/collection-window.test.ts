import {expect,it} from "vitest";
import {retainRecentOrHeard} from "./collection-window";
import type {Application} from "./adapters/types";
it("retains all eight reviewed old heard projects while excluding unrelated historic filings",()=>{
 const numbers=["202600273","202601088","202600638","202601398","202601317","202600819","202600934","202103209"],apps=numbers.map(id=>({recordId:id+"-CU",received:"2021-01-01"} as Application)),linked=new Set(apps.map(a=>a.recordId));
 expect(retainRecentOrHeard([...apps,{recordId:"OLD",received:"2021-01-01"} as Application,{recordId:"RECENT",received:"2026-10-01"} as Application,{recordId:"UNDATED"} as Application],linked,"2026-07-30").map(a=>a.recordId)).toEqual([...apps.map(a=>a.recordId),"RECENT","UNDATED"]);
});
