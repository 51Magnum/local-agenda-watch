import {expect,it} from "vitest";
import {automaticJurisdictionColor,withJurisdictionColors} from "./jurisdiction-colors.mjs";
import {contrastWithWhite,validateJurisdictions} from "../jurisdictions/validate";
import {jurisdiction,JURISDICTION_REGISTRY} from "../jurisdictions/registry";
it("assigns stable readable defaults without a color choice or a model",()=>{
 const rows=Array.from({length:200},(_,i)=>({id:"test-city-"+i})),colors=withJurisdictionColors(rows);
 expect(new Set(colors.map(a=>a.color)).size).toBe(rows.length);
 for(const a of colors){expect(a.color).toMatch(/^#[0-9a-f]{6}$/);expect(contrastWithWhite(a.color)).toBeGreaterThanOrEqual(4.5);}
 expect(automaticJurisdictionColor("new-city")).toBe(automaticJurisdictionColor("new-city"));
 expect(withJurisdictionColors([{id:"new-city",name:"Original"}])[0].color).toBe(withJurisdictionColors([{id:"new-city",name:"Renamed"}])[0].color);
});
it("preserves existing jurisdiction colors and automatically avoids a reserved color",()=>{
 const existing=Object.values(JURISDICTION_REGISTRY);expect(withJurisdictionColors(existing).map(d=>d.color)).toEqual(existing.map(d=>d.color));
 const candidate=automaticJurisdictionColor("new-city"),rows=withJurisdictionColors([{id:"existing",color:candidate.toUpperCase()},{id:"new-city"}]);expect(rows[1].color).not.toBe(candidate);expect(rows[0].color).toBe(candidate.toUpperCase());
});
it("accepts a registry entry with no manual color and still rejects invalid or duplicate explicit colors",()=>{
 expect(()=>validateJurisdictions([null])).toThrow("invalid id");
 const raw={...jurisdiction("boise"),id:"new-city",color:undefined};const [resolved]=validateJurisdictions([raw]);expect(resolved.color).toBe(automaticJurisdictionColor("new-city"));expect(raw.color).toBeUndefined();
 expect(()=>validateJurisdictions([{...raw,color:"invalid"}])).toThrow("distinct color");
 expect(()=>validateJurisdictions([{...raw,id:"first-city",color:"#123abc"},{...raw,id:"second-city",color:"#123ABC"}])).toThrow("distinct color");
});
