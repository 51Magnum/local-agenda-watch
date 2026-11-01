import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
vi.mock("@/lib/areas/registry",()=>({visibleAreas:async()=>[{id:"ada-county",name:"Ada County",stateAbbreviation:"ID",status:"live"}]}));
import About from "./page";
it("lists snapshot-published Ada through the visible-area authority",async()=>{expect(renderToStaticMarkup(await About())).toContain("Ada County");});
