import {expect,it} from "vitest";
import {opensCasePage} from "./case-interaction";
it("opens a project on a mouse click, while touch and pen preview first",()=>{
 expect(opensCasePage(false,"mouse")).toBe(true);
 expect(opensCasePage(false,"touch")).toBe(false);
 expect(opensCasePage(false,"pen")).toBe(false);
 expect(opensCasePage(false,"mouse",true)).toBe(false);
 expect(opensCasePage(true,"mouse")).toBe(false);
});
