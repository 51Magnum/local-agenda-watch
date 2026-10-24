import {expect,it} from "vitest";
import {runInNewContext} from "node:vm";
import {THEME_BOOTSTRAP} from "./theme";
it.each([["light",true,"light"],["dark",false,"dark"],["system",true,"dark"],[null,false,"light"],["invalid",true,"dark"]])("applies saved %s with browser dark=%s before paint",(saved,dark,expected)=>{
 const root={dataset:{} as Record<string,string>,style:{} as Record<string,string>};
 runInNewContext(THEME_BOOTSTRAP,{document:{documentElement:root},localStorage:{getItem:()=>saved},matchMedia:()=>({matches:dark})});
 expect(root.dataset.theme).toBe(expected);expect(root.style.colorScheme).toBe(expected);
});
it("falls back to the browser preference when storage is blocked",()=>{
 const root={dataset:{} as Record<string,string>,style:{}};
 runInNewContext(THEME_BOOTSTRAP,{document:{documentElement:root},localStorage:{getItem:()=>{throw new Error("blocked");}},matchMedia:()=>({matches:true})});
 expect(root.dataset.theme).toBe("dark");expect(root.dataset.themePreference).toBe("system");
});
