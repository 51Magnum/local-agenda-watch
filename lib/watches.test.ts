import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWatchSnapshot, isWatching, parseWatches, resolveWatchedProjects, setWatching, subscribeWatches, watchFromCase, WATCH_STORAGE_KEY, type WatchedProject } from "./watches";
import type { MapCase } from "./maps/types";
const project: WatchedProject = { jurisdiction: "nampa", href: "/nampa/braeburn-creek", title: "Braeburn Creek", caseIds: ["ANN-00371-2026", "SPP-00184-2026"] };
beforeEach(() => {
  const values = new Map<string,string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string,value: string) => values.set(key,value) });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("browser-local watches", () => {
  it("persists, deduplicates and removes watches while notifying same-tab subscribers", () => {
    const listener = vi.fn(), unsubscribe = subscribeWatches(listener);
    setWatching(project,true); expect(isWatching(project)).toBe(true);
    setWatching(project,true); expect(parseWatches(getWatchSnapshot())).toEqual([project]);
    expect(listener).toHaveBeenCalledTimes(2);
    setWatching(project,false); expect(isWatching(project)).toBe(false); expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe(); setWatching(project,true); expect(listener).toHaveBeenCalledTimes(3);
  });
  it("groups related cases by their project page and never stores geometry or a searched address", () => {
    const first = { id:"ANN-00371-2026", href:project.href, title:"Braeburn Creek annexation" } as MapCase;
    const second = { id:"SPP-00184-2026", href:project.href, title:"Braeburn Creek preliminary plat" } as MapCase;
    const unrelated = { id:"ANN-00369-2026", href:"/nampa/plan/ANN-00369-2026" } as MapCase;
    const entry = watchFromCase("nampa",first,[first,second,unrelated]);
    expect(entry.caseIds).toEqual(project.caseIds); setWatching(entry,true);
    setWatching(watchFromCase("nampa",second,[first,second]),true);
    expect(parseWatches(getWatchSnapshot())).toHaveLength(1);
    expect(Object.keys(entry).sort()).toEqual(["caseIds","href","jurisdiction","title"]);
  });
  it("shows current status/hearing from the city feed and separates jurisdictions", () => {
    const rows = resolveWatchedProjects([project,{...project,jurisdiction:"caldwell",href:"/caldwell/project"}],"nampa",[
      {href:project.href,title:"Braeburn Creek",caseIds:["ANN-00371-2026"],status:"Council hearing",hearing:"City Council — November 2, 2026"},
      {href:project.href,title:"Braeburn Creek",caseIds:["SPP-00184-2026"],status:"Council hearing"},
    ]);
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({title:"Braeburn Creek",status:"Council hearing",hearing:"City Council — November 2, 2026",caseIds:project.caseIds});
  });
  it("responds to cross-tab storage changes and keeps saved projects when a feed record is unavailable", () => {
    const listener=vi.fn(),unsubscribe=subscribeWatches(listener);
    window.dispatchEvent(Object.assign(new Event("storage"),{key:WATCH_STORAGE_KEY})); expect(listener).toHaveBeenCalledOnce(); unsubscribe();
    expect(resolveWatchedProjects([project],"nampa",[])[0]).toMatchObject({title:project.title,href:project.href,status:undefined});
  });
  it("handles corrupt data, rejects unsafe links, and reports a failed write", () => {
    expect(parseWatches("broken")).toEqual([]);
    expect(parseWatches(JSON.stringify({version:1,items:[{...project,href:"javascript:alert(1)"},{...project,href:"//example.com"}]}))).toEqual([]);
    vi.stubGlobal("localStorage",{getItem:()=>{throw new Error("blocked");},setItem:()=>{throw new Error("blocked");}});
    expect(getWatchSnapshot()).toBe(""); expect(()=>setWatching(project,true)).toThrow("Could not save your watch");
  });
});
