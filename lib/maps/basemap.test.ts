import {afterEach,beforeEach,expect,it,vi} from "vitest";
import type {Map as LibreMap,LayerSpecification} from "maplibre-gl";
import {basemapChoice,chooseBasemap,subscribeBasemap,BASEMAP_SESSION_KEY} from "./basemap-choice";
import {installBasemap,SATELLITE_LAYER,SATELLITE_SOURCE,USGS_IMAGERY} from "./basemap";

function browser(blocked=false){
 const values=new Map<string,string>(),target=new EventTarget();
 Object.assign(target,{sessionStorage:{getItem:(key:string)=>{if(blocked)throw Error("Storage blocked");return values.get(key)??null;},setItem:(key:string,value:string)=>{if(blocked)throw Error("Storage blocked");values.set(key,value);}}});
 vi.stubGlobal("window",target);return values;
}
function fixture(loaded=true){
 const sources=new Map(),events=new Map<string,Set<()=>void>>();
 const layers:LayerSpecification[]=[{id:"background",type:"background"},{id:"land",type:"fill",source:"base"},{id:"roads",type:"line",source:"base",layout:{visibility:"none"}},{id:"road-labels",type:"symbol",source:"base"},{id:"places",type:"symbol",source:"base"}];
 const map={isStyleLoaded:()=>loaded,getStyle:()=>({layers}),getLayer:(id:string)=>layers.find(l=>l.id===id),getSource:(id:string)=>sources.get(id),
  addSource:vi.fn((id:string,value:unknown)=>sources.set(id,value)),addLayer:vi.fn((layer:LayerSpecification,before?:string)=>layers.splice(before?layers.findIndex(l=>l.id===before):layers.length,0,structuredClone(layer))),
  setLayoutProperty:vi.fn((id:string,key:string,value:unknown)=>{const layer=layers.find(l=>l.id===id)!;layer.layout={...layer.layout,[key]:value};}),
  on:(event:string,fn:()=>void)=>{if(!events.has(event))events.set(event,new Set());events.get(event)!.add(fn);},off:(event:string,fn:()=>void)=>events.get(event)?.delete(fn)};
 const fire=(event:string)=>events.get(event)?.forEach(fn=>fn());
 return {map:map as unknown as LibreMap,spy:map,layers,sources,fire,visibility:(id:string)=>layers.find(l=>l.id===id)?.layout?.visibility??"visible"};
}
beforeEach(()=>browser());afterEach(()=>vi.unstubAllGlobals());
it("defaults to Map and requests exactly the configured public USGS raster source",()=>{
 const f=fixture();installBasemap(f.map);
 expect(basemapChoice()).toBe("map");expect(f.visibility(SATELLITE_LAYER)).toBe("none");
 expect(f.sources.get(SATELLITE_SOURCE)).toEqual({type:"raster",tiles:["https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"],tileSize:256,maxzoom:16,attribution:"USGS The National Map"});
 expect(f.layers.find(l=>l.id===SATELLITE_LAYER)?.maxzoom).toBeUndefined();
});
it("keeps labels above imagery and leaves every later overlay and its source unchanged",()=>{
 const f=fixture();installBasemap(f.map);
 const overlayIds=["project-fill","project-outline","boundary","flum","radius","pin"];
 for(const id of overlayIds)f.spy.addLayer({id,type:"line",source:id});
 const before=structuredClone(f.layers.filter(l=>overlayIds.includes(l.id)));
 chooseBasemap("satellite");
 expect(f.visibility("background")).toBe("none");expect(f.visibility("land")).toBe("none");
 expect(f.visibility("road-labels")).toBe("visible");expect(f.visibility("places")).toBe("visible");expect(f.visibility(SATELLITE_LAYER)).toBe("visible");
 expect(f.layers.findIndex(l=>l.id===SATELLITE_LAYER)).toBeLessThan(f.layers.findIndex(l=>l.id==="road-labels"));
 expect(f.layers.filter(l=>overlayIds.includes(l.id))).toEqual(before);
 expect(f.spy.addSource).toHaveBeenCalledOnce();
 chooseBasemap("map");expect(f.visibility("land")).toBe("visible");expect(f.visibility("roads")).toBe("none");expect(f.visibility(SATELLITE_LAYER)).toBe("none");
});
it("honors selection before style load, installs once, and releases listeners on removal",()=>{
 const f=fixture(false),dispose=installBasemap(f.map);expect(installBasemap(f.map)).toBe(dispose);
 chooseBasemap("satellite");expect(f.spy.addSource).not.toHaveBeenCalled();
 f.fire("style.load");expect(f.visibility(SATELLITE_LAYER)).toBe("visible");
 f.fire("style.load");expect(f.spy.addSource).toHaveBeenCalledOnce();
 f.fire("remove");f.spy.setLayoutProperty.mockClear();chooseBasemap("map");expect(f.spy.setLayoutProperty).not.toHaveBeenCalled();
});
it("remembers the choice for new maps in this session and synchronizes mounted maps",()=>{
 const storage=browser(),first=fixture(),second=fixture();installBasemap(first.map);installBasemap(second.map);
 chooseBasemap("satellite");expect(storage.get(BASEMAP_SESSION_KEY)).toBe("satellite");
 expect(first.visibility(SATELLITE_LAYER)).toBe("visible");expect(second.visibility(SATELLITE_LAYER)).toBe("visible");
 const next=fixture();installBasemap(next.map);expect(next.visibility(SATELLITE_LAYER)).toBe("visible");
 browser();expect(basemapChoice()).toBe("map");
});
it("works when session storage is unavailable and unsubscribes controls",()=>{
 browser(true);const changed=vi.fn(),unsubscribe=subscribeBasemap(changed);
 chooseBasemap("satellite");expect(basemapChoice()).toBe("satellite");expect(changed).toHaveBeenCalledOnce();
 unsubscribe();chooseBasemap("map");expect(basemapChoice()).toBe("map");expect(changed).toHaveBeenCalledOnce();
});
it("contains no credential or paid source requirement",()=>{
 expect(USGS_IMAGERY.tiles?.[0]).not.toMatch(/token|key|secret/i);
});
