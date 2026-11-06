// Local browser regression: node scripts/check-map-ui.mjs.
// Uses Playwright (or LAW_PLAYWRIGHT_MODULE), esbuild from tsx, and committed public fixtures.
// No database, authentication secrets, email, AI, or external requests are used.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {build} from "esbuild";
import sharp from "sharp";
import {packViewport} from "../lib/maps/viewport-wire.ts";
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.LAW_PLAYWRIGHT_MODULE ?? "playwright");
const root = process.cwd(), out = path.join(root,"output/map-ui-browser");
fs.mkdirSync(out,{recursive:true});
const records = JSON.parse(fs.readFileSync("tests/fixtures/nampa-map-clicks.json","utf8"));
const boundaries = JSON.parse(fs.readFileSync("public/map-data/boundaries.json","utf8"));
const item = records[0].map, project = records[0].project;
const menuCheck=process.argv.includes("--menus");
const boundaryColorCheck=process.argv.includes("--boundary-colors");
const markerToggleCheck=process.argv.includes("--marker-toggle");
const markerCheck=process.argv.includes("--markers");
const publicationCheck=process.argv.includes("--publication-cache");
const adaCases=JSON.parse(fs.readFileSync("data/review/ada-county.json","utf8")).map.cases;
const satelliteCheck=process.argv.includes("--satellite"),satelliteLayer="law-satellite-basemap";
const imageryTile=await sharp({create:{width:256,height:256,channels:3,background:{r:75,g:100,b:65}}}).png().toBuffer();
const area = {id:"nampa",name:"Nampa",stateAbbreviation:"ID",href:"/us/id/nampa",center:item.centroid,bounds:[-117,43,-116,44],status:"live"};
const landUse={jurisdiction:"nampa",geojson:{type:"FeatureCollection",features:[{type:"Feature",geometry:item.geometry,properties:{category:"Residential"}}]},legend:[{value:"Residential",label:"Residential",color:"#edb875"}],categoryField:"category",updatedAt:"2026-11-04T12:00:00Z"};
const mapData = {jurisdiction:{...area,zoom:13},cases:records.map(r=>r.map),updatedAt:"2026-11-04T12:00:00Z",warnings:[],flum:{legend:landUse.legend,categoryField:"category",layerUrl:"https://official.test/land-use"}};
await build({stdin:{contents:`
import React from 'react'; import {createRoot} from 'react-dom/client';
import Home from './app/components/maps/map-home';
import CaseMap from './app/components/maps/case-map';
import Coverage from './app/components/locations/coverage-map';
import Preview from './app/admin/jurisdictions/preview-map';
import Notice,{useMapNotice} from './app/components/maps/map-notice';
import {getArea} from './lib/areas/public-registry';
const fixture=${JSON.stringify({item,boundaries})};
function NoticeDemo(){const {notice,showNotice,dismissNotice}=useMapNotice();return <><button onClick={()=>showNotice('Saved.')}>Show notice</button><button onClick={()=>showNotice('Unavailable.','error')}>Show error</button>{notice&&<Notice key={notice.id} {...notice} onDismiss={dismissNotice}/>}</>}
const route=location.pathname;
createRoot(document.getElementById('root')).render(route==='/home'?<Home/>:route==='/project'?<CaseMap jurisdiction="nampa" caseIds={[fixture.item.id]} compact/>:route==='/area'?<CaseMap jurisdiction="nampa"/>:route==='/coverage'?<div style={{display:"grid",height:600}}><Coverage areas={[getArea('nampa')]}/></div>:route==='/admin'?<Preview boundaries={fixture.boundaries.polygons} cases={{type:'FeatureCollection',features:[{type:'Feature',geometry:fixture.item.geometry,properties:{areaId:'nampa',caseId:fixture.item.id,color:'#0f766e'}}]}}/>:<NoticeDemo/>);
`,resolveDir:root,loader:"tsx"},outfile:path.join(out,"app.js"),bundle:true,format:"esm",platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"',"process.env":"{}"},alias:{"@":root},logLevel:"silent",plugins:[{name:"local-map-observer",setup(builder){
 const real=JSON.stringify(path.join(root,"node_modules/maplibre-gl/dist/maplibre-gl.mjs").replaceAll("\\","/"));
 builder.onResolve({filter:/^maplibre-gl$/},()=>({path:"test-map",namespace:"test-map"}));
 builder.onLoad({filter:/.*/,namespace:"test-map"},()=>({contents:`export * from ${real};import {Map as Original} from ${real};export class Map extends Original{constructor(options){super(options);window.__lawTestMap=this;}}`,loader:"js",resolveDir:root}));
}}]});
const styles = fs.readdirSync(".next/static/chunks").filter(f=>f.endsWith(".css")).map(f=>fs.readFileSync(".next/static/chunks/"+f,"utf8")).join("\n");
const server = http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  if(pathname==="/app.js"){res.setHeader("Content-Type","text/javascript");res.end(fs.readFileSync(path.join(out,"app.js")));}
  else if(pathname==="/styles.css"){res.setHeader("Content-Type","text/css");res.end(styles+fs.readFileSync(path.join(out,"app.css"),"utf8"));}
  else if(pathname==="/maplibre/worker.mjs"){res.setHeader("Content-Type","text/javascript");res.end(fs.readFileSync("public/maplibre/worker.mjs"));}
  else {res.setHeader("Content-Type","text/html");res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin="http://127.0.0.1:"+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.LAW_PLAYWRIGHT_CHANNEL?{channel:process.env.LAW_PLAYWRIGHT_CHANNEL}:{})}),passed=[];
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,isMobile:mobile}),page=await context.newPage(),errors=[];
  page.on("pageerror",e=>{errors.push(e.message);console.error("Browser:",e.message);});let rasterRequests=0,fixtureRevision="before-publication";
  await page.route("**/*",route=>{
   const u=new URL(route.request().url()),url=u.pathname;
   if(u.hostname==="tiles.openfreemap.org")return route.fulfill({json:{version:8,sources:{base:{type:"geojson",data:{type:"FeatureCollection",features:[]}}},layers:[{id:"background",type:"background",paint:{"background-color":"#e2e8f0"}},{id:"base-roads",type:"line",source:"base"},{id:"base-road-labels",type:"symbol",source:"base"},{id:"base-places",type:"symbol",source:"base"}]}});
   if(u.hostname==="basemap.nationalmap.gov"){rasterRequests++;return route.fulfill({contentType:"image/png",headers:{"access-control-allow-origin":"*"},body:imageryTile});}
   if(u.origin!==origin)return route.abort();
   const json=url==="/api/map/meta"?{revision:fixtureRevision,areas:[area]}:url==="/api/map/cases"?packViewport({cases:[...(markerCheck?records.slice(0,1):records).map(r=>({...r.map,id:"nampa:"+r.id,areaId:"nampa"})),...(publicationCheck&&fixtureRevision==="after-publication"&&u.searchParams.get("v")==="publication-v2:after-publication"?adaCases.map(c=>({...c,id:"ada-county:"+c.id,areaId:"ada-county",geometry:Number(u.searchParams.get("zoom"))<11?null:c.geometry})):[])],summaries:[],truncated:false,updatedAt:mapData.updatedAt,bounds:area.bounds}):url==="/api/map/coverage"?{areas:["Nampa"]}:url==="/api/map/project"?project:url==="/api/map/boundaries"?boundaries:url==="/api/maps/nampa"?(u.searchParams.get("layer")==="flum"?landUse:mapData):url==="/api/account/pins"?{pins:Array.from({length:5},(_,i)=>({id:"fixture-"+i,label:"Test pin "+(i+1),coordinates:[item.centroid[0]+i*.002,item.centroid[1]],radiusMiles:1,alertsEnabled:false}))}:url.startsWith("/admin/jurisdictions/")?project:undefined;
   if(json)return route.fulfill({json});
   if(url.startsWith("/api/"))return route.fulfill({json:{projects:[],areas:[]}});
   return route.continue();
  });
  const prefix=mobile?"mobile":"desktop";
  for(const view of ((boundaryColorCheck||menuCheck)?["home","project","area","coverage"]:(publicationCheck||markerCheck||markerToggleCheck)?["home"]:["home","project","area","coverage","admin"])){
   console.log(prefix+": checking "+view);
   await page.goto(origin+"/"+view);await page.locator(".law-map-attribution").waitFor();
   const attribution=page.locator(".maplibregl-ctrl-attrib"),toggle=attribution.locator("summary");
   assert.equal(await attribution.count(),1,view+" attribution count");assert.equal(await toggle.count(),1);
   assert.equal(await attribution.getAttribute("open"),null,view+" initially expanded");
   const style=await toggle.evaluate(e=>{const s=getComputedStyle(e);return {width:s.width,height:s.height,repeat:s.backgroundRepeat};});
   assert.deepEqual(style,{width:"24px",height:"24px",repeat:"no-repeat"});
   if(mobile)await toggle.tap();else await toggle.click();
   for(const credit of ["OpenFreeMap","OpenMapTiles","OpenStreetMap"])await attribution.getByRole("link",{name:credit,exact:true}).waitFor();
   if(mobile)await toggle.tap();else await toggle.click();assert.equal(await attribution.getAttribute("open"),null);
   passed.push(prefix+": "+view+" has one collapsed attribution, one icon, and expandable provider links");
   if(menuCheck){
    const trigger=view==="home"?page.getByRole("button",{name:"Layers",exact:true}):page.locator(".law-basemap-layers>summary"),panel=view==="home"?page.locator("#map-layer-options"):page.locator(".law-basemap-options");
    const outside=async()=>{const size=page.viewportSize();if(mobile)await page.touchscreen.tap(size.width-2,size.height-2);else await page.mouse.move(size.width-2,size.height-2);await panel.waitFor({state:"hidden"});};
    const open=async()=>{if(mobile)await trigger.tap();else await trigger.hover();await panel.waitFor({state:"visible"});};
    await open();await panel.getByRole("button",{name:"Satellite",exact:true}).click();assert(await panel.isVisible());await outside();
    if(view==="home"){
     const legendTrigger=page.getByRole("button",{name:"Legend",exact:true}),legendPanel=page.locator("#map-progress-legend");if(mobile)await legendTrigger.tap();else await legendTrigger.hover();await legendPanel.waitFor({state:"visible"});if(mobile)await page.touchscreen.tap(2,2);else await page.mouse.move(2,2);await legendPanel.waitFor({state:"hidden"});
     await open();const saved=page.getByRole("checkbox",{name:/Show saved pins/});await saved.uncheck();assert(await panel.isVisible());await page.waitForFunction(()=>document.querySelectorAll(".law-saved-pin-marker").length===0);assert.equal(await page.evaluate(()=>localStorage.getItem("law:saved-pins-visible")),"false");
     await page.reload();await page.locator(".law-map-attribution").waitFor();await open();assert(!(await saved.isChecked()));assert.equal(await page.locator(".law-saved-pin-marker").count(),0);await saved.check();await page.waitForFunction(()=>document.querySelectorAll(".law-saved-pin-marker").length===5);await outside();
     passed.push(prefix+": saved-pin visibility survives reload and restores markers when enabled");
    }
    if(!mobile){await trigger.focus();await trigger.press("Enter");await panel.waitFor({state:"visible"});await page.waitForFunction(()=>{const active=document.activeElement;return !!active.closest("#map-layer-options,.law-basemap-options");});await page.keyboard.press("Escape");await panel.waitFor({state:"hidden"});assert(await trigger.evaluate(e=>e===document.activeElement));}
    passed.push(prefix+": "+view+" opens on hover/tap, stays open for menu actions, and dismisses when leaving/outside tapping");continue;
   }
   if(boundaryColorCheck){
    const source=view==="home"?"law-boundaries":view==="coverage"?"coverage":"boundaries",layer=view==="home"?"law-boundaries":view==="coverage"?"coverage-city-border":"city-limits";
    await page.waitForFunction(source=>window.__lawTestMap?.getStyle().sources[source]?.data.features.length>1,source);
    const before=await page.evaluate(({source,layer})=>{const m=window.__lawTestMap;return {paint:m.getPaintProperty(layer,"line-color"),colors:m.getStyle().sources[source].data.features.map(f=>f.properties.color)};},{source,layer});
    assert(JSON.stringify(before.paint).includes('"get","color"'));assert.equal(new Set(before.colors).size,before.colors.length);
    if(view==="home"){
     await page.getByRole("button",{name:"Layers",exact:true}).click();const check=page.getByRole("checkbox",{name:"Jurisdiction boundaries",exact:true});await check.uncheck();await page.waitForFunction(()=>["law-boundaries","law-boundary-halo","law-area-labels"].every(id=>window.__lawTestMap.getLayoutProperty(id,"visibility")==="none"));await check.check();
    }else await page.locator(".law-basemap-layers>summary").click();
    await page.getByRole("button",{name:"Satellite",exact:true}).click();await page.waitForFunction(()=>window.__lawTestMap.getLayoutProperty("law-satellite-basemap","visibility")==="visible");
    assert.deepEqual(await page.evaluate(({source,layer})=>{const m=window.__lawTestMap;return {paint:m.getPaintProperty(layer,"line-color"),colors:m.getStyle().sources[source].data.features.map(f=>f.properties.color)};},{source,layer}),before);
    if(view==="home"){await page.getByRole("button",{name:"Legend",exact:true}).click();await page.locator("#map-progress-legend").getByText("Jurisdiction boundaries",{exact:true}).waitFor();for(const name of ["Nampa","Unincorporated Canyon County"])await page.locator("#map-progress-legend").getByText(name,{exact:true}).waitFor();}
    passed.push(prefix+": "+view+" uses distinct jurisdiction colors across Map/Satellite with matching boundary key and toggle");continue;
   }
   if(markerToggleCheck){
    await page.waitForFunction(()=>window.__lawTestMap?.getLayer("law-summary-count")&&window.__lawTestMap.loaded());
    await page.getByRole("button",{name:"Layers",exact:true}).click();
    const checkbox=page.getByRole("checkbox",{name:"Project markers",exact:true}),ids=["law-clusters","law-dots","law-cluster-count","law-summary-dots","law-summary-count"];
    assert(await checkbox.isChecked());await checkbox.uncheck();
    for(const zoom of [8,10,13]){
     await page.evaluate(zoom=>window.__lawTestMap.jumpTo({zoom}),zoom);
     await page.waitForFunction(ids=>ids.every(id=>window.__lawTestMap.getLayoutProperty(id,"visibility")==="none"),ids);
     assert.equal(await page.evaluate(ids=>window.__lawTestMap.queryRenderedFeatures({layers:ids}).length,ids),0);
    }
    const before=await page.evaluate(()=>{const m=window.__lawTestMap;return {center:m.getCenter().toArray(),zoom:m.getZoom(),time:performance.timeOrigin};});
    await page.getByRole("button",{name:"Satellite",exact:true}).click();
    await page.waitForFunction(()=>window.__lawTestMap.getLayoutProperty("law-satellite-basemap","visibility")==="visible");
    assert(await page.evaluate(ids=>ids.every(id=>window.__lawTestMap.getLayoutProperty(id,"visibility")==="none"),ids));
    assert.deepEqual(await page.evaluate(()=>{const m=window.__lawTestMap;return {center:m.getCenter().toArray(),zoom:m.getZoom(),time:performance.timeOrigin};}),before);
    await page.reload();await page.locator(".law-map-attribution").waitFor();await page.getByRole("button",{name:"Layers",exact:true}).click();assert(!(await checkbox.isChecked()));
    await page.waitForFunction(ids=>ids.every(id=>window.__lawTestMap.getLayoutProperty(id,"visibility")==="none"),ids);
    await checkbox.check();await page.waitForFunction(ids=>ids.every(id=>window.__lawTestMap.getLayoutProperty(id,"visibility")==="visible"),ids);
    passed.push(prefix+": marker switch hides circles and counts at overview and close zooms, preserves Satellite and viewport, remembers the session, and restores markers");continue;
   }
   if(markerCheck){
    await page.waitForFunction(()=>window.__lawTestMap?.getStyle().sources["law-points"]?.data.features.length===1);
    await page.evaluate(center=>window.__lawTestMap.jumpTo({center,zoom:10}),item.centroid);
    await page.waitForFunction(()=>window.__lawTestMap.queryRenderedFeatures({layers:["law-dots"]}).length>0);
    const paint=await page.evaluate(()=>{const m=window.__lawTestMap;return {single:m.getPaintProperty("law-dots","circle-color"),cluster:m.getPaintProperty("law-clusters","circle-color"),singleRadius:m.getPaintProperty("law-dots","circle-radius"),clusterRadius:m.getPaintProperty("law-clusters","circle-radius"),count:m.getLayoutProperty("law-cluster-count","text-field"),filter:m.getFilter("law-cluster-count")};});
    assert.equal(paint.single,paint.cluster);assert.equal(paint.singleRadius,paint.clusterRadius);assert.equal(paint.single,"#0f766e");
    assert.deepEqual(paint.count,["to-string",["coalesce",["get","point_count_abbreviated"],1]]);assert(!paint.filter);
    passed.push(prefix+": single project uses the same green circle size and count-label layer, displaying 1");
    const position=await page.evaluate(center=>{const p=window.__lawTestMap.project(center);return {x:p.x,y:p.y};},item.centroid);
    const canvas=page.locator(".maplibregl-canvas");if(mobile)await canvas.tap({position});else await canvas.click({position});
    await page.locator(".law-resident-pane").waitFor();
    passed.push(prefix+": clicking/tapping a single green circle opens its project pane");
    continue;
   }
    if(publicationCheck){
    await page.waitForFunction(()=>window.__lawTestMap?.getStyle().sources["law-points"]?.data.features.length>0);
    assert(!(await page.evaluate(()=>window.__lawTestMap.getStyle().sources["law-points"].data.features.some(f=>f.properties.id.startsWith("ada-county:")))));
    fixtureRevision="after-publication";
    await page.reload();await page.locator(".law-map-attribution").waitFor();
    const target=adaCases.find(c=>c.geometry&&c.centroid[0]>-116.2&&c.centroid[1]<43.6);
    await page.evaluate(center=>window.__lawTestMap.jumpTo({center,zoom:10}),target.centroid);
    await page.waitForFunction(()=>window.__lawTestMap.getStyle().sources["law-points"].data.features.some(f=>f.properties.id.startsWith("ada-county:")));
    await page.waitForFunction(async()=>{
     const m=window.__lawTestMap,p=m.project(m.getCenter());
     const hits=m.queryRenderedFeatures([[p.x-60,p.y-60],[p.x+60,p.y+60]],{layers:["law-clusters","law-dots"]});
     for(const hit of hits){
      if(String(hit.properties.id).startsWith("ada-county:"))return true;
      if(hit.properties.cluster_id!==undefined){const leaves=await m.getSource("law-points").getClusterLeaves(hit.properties.cluster_id,1000,0);if(leaves.some(f=>f.properties.id.startsWith("ada-county:")))return true;}
     }
     return false;
    });
    passed.push(prefix+": published Ada appears as overview markers/clusters despite old cell responses");
    await page.evaluate(()=>window.__lawTestMap.jumpTo({zoom:12}));
    await page.waitForFunction(()=>window.__lawTestMap.getStyle().sources["law-polygons"].data.features.some(f=>f.properties.id.startsWith("ada-county:")));
    passed.push(prefix+": same published Ada records appear as polygons when zooming in");
    continue;
   }
   if(satelliteCheck){
    await page.waitForFunction(()=>window.__lawTestMap?.getLayer("law-satellite-basemap")&&window.__lawTestMap.loaded()&&!window.__lawTestMap.isMoving());

   const openLayers=async()=>{if(view==="home"){const button=page.getByRole("button",{name:"Layers",exact:true});if(await button.getAttribute("aria-expanded")!=="true")await button.click();}else await page.locator(".law-basemap-layers:not([open])>summary").click();};
    await openLayers();
    if(view==="area"||view==="project"){await page.getByRole("checkbox",{name:"Future land use",exact:true}).check();await page.waitForFunction(()=>window.__lawTestMap.getStyle().sources.flum.data.features.length>0);}
    const before=await page.evaluate(()=>{const m=window.__lawTestMap;return {center:m.getCenter().toArray(),zoom:m.getZoom(),time:performance.timeOrigin,overlays:m.getStyle().layers.filter(l=>!l.id.startsWith("base-")&&l.id!=="background"&&l.id!=="law-satellite-basemap")};});
    const satellite=page.getByRole("group",{name:"Basemap",exact:true}).getByRole("button",{name:"Satellite",exact:true});assert((await satellite.boundingBox()).height>=44);
    if(mobile)await satellite.tap();else await satellite.click();await page.waitForFunction(()=>window.__lawTestMap.getLayoutProperty("law-satellite-basemap","visibility")==="visible");
    assert.equal(await satellite.evaluate(e=>getComputedStyle(e).backgroundColor),"rgb(19, 78, 74)","Selected basemap is not visibly highlighted");
    const after=await page.evaluate(()=>{const m=window.__lawTestMap,layers=m.getStyle().layers;return {center:m.getCenter().toArray(),zoom:m.getZoom(),time:performance.timeOrigin,overlays:layers.filter(l=>!l.id.startsWith("base-")&&l.id!=="background"&&l.id!=="law-satellite-basemap"),ids:layers.map(l=>l.id),roadLabels:m.getLayoutProperty("base-road-labels","visibility"),source:m.getStyle().sources["law-usgs-imagery"]};});
    if(view==="area"||view==="project")assert((await page.evaluate(()=>window.__lawTestMap.getStyle().sources.flum.data.features.length))>0,"Future land use disappeared");
    assert.deepEqual(after.center,before.center);assert.equal(after.zoom,before.zoom);assert.equal(after.time,before.time);assert.deepEqual(after.overlays,before.overlays);assert.notEqual(after.roadLabels,"none");assert(after.ids.indexOf(satelliteLayer)<after.ids.indexOf("base-road-labels"));assert.equal(after.source.maxzoom,16);
    await toggle.click();await page.waitForFunction(()=>document.querySelector(".maplibregl-ctrl-attrib-inner")?.textContent.includes("USGS The National Map"));await toggle.click();assert.equal(await attribution.count(),1);
    passed.push(prefix+": "+view+" satellite preserves viewport, labels, overlay layers, and one compact attribution with USGS credit");
    await page.reload();await page.locator(".law-map-attribution").waitFor();await openLayers();await page.getByRole("button",{name:"Satellite",exact:true,pressed:true}).waitFor();
    await page.getByRole("button",{name:"Map",exact:true}).click();await page.waitForFunction(()=>window.__lawTestMap.getLayoutProperty("law-satellite-basemap","visibility")==="none");
    await page.waitForFunction(()=>!document.querySelector(".maplibregl-ctrl-attrib-inner")?.textContent.includes("USGS The National Map"));
    if(view==="home")await page.getByRole("button",{name:"Layers",exact:true}).click();else await page.locator(".law-basemap-layers>summary").click();
    passed.push(prefix+": "+view+" remembers Satellite after reload and restores Map credits");
   }
   if(view==="home"){
    await page.getByRole("button",{name:"Layers",exact:true}).click();await page.getByRole("button",{name:/1\. Test pin 1/}).waitFor();
    for(let i=1;i<=5;i++)await page.getByRole("button",{name:new RegExp(i+"\\. Test pin "+i)}).click();
    if(satelliteCheck){
     const ring=await page.evaluate(()=>window.__lawTestMap.getStyle().sources["law-ring"].data);assert(ring.features.length>0);
     await page.getByRole("button",{name:"Satellite",exact:true}).click();
     assert.equal(await page.locator(".law-saved-pin-marker").count(),5);assert.deepEqual(await page.evaluate(()=>window.__lawTestMap.getStyle().sources["law-ring"].data),ring);
     passed.push(prefix+": selected saved pin, five markers and radius circle survive Satellite switch");
    }
    await page.getByRole("button",{name:"Layers",exact:true}).click();
    assert.equal(await page.locator(".maplibregl-ctrl-attrib").count(),1);passed.push(prefix+": all five saved pins selectable without duplicate attribution");
    await page.getByRole("button",{name:"Clear pin & circle",exact:true}).first().click();
    const notice=page.locator(".law-map-notice");await notice.filter({hasText:"Pin and circle cleared."}).waitFor();
    await page.mouse.move(0,0);await page.waitForTimeout(4200);assert.equal(await notice.count(),0);passed.push(prefix+": pin-cleared notice automatically dismisses");
    if(satelliteCheck){
     await page.evaluate(center=>window.__lawTestMap.jumpTo({center,zoom:15}),item.centroid);await page.waitForFunction(()=>window.__lawTestMap.loaded()&&!window.__lawTestMap.isMoving());
     const point=await page.evaluate(center=>{const p=window.__lawTestMap.project(center);return {x:p.x,y:p.y};},item.centroid);
     const canvas=page.locator(".maplibregl-canvas");if(mobile)await canvas.tap({position:point});else await canvas.click({position:point});
     await page.locator(".law-resident-pane").waitFor();passed.push(prefix+": project polygon opens its pane from a center click/tap in Satellite mode");
    }
    await page.goto(origin+"/home?project=nampa/"+item.id);await page.locator(".law-resident-pane").waitFor();
    const pane=await page.locator(".law-resident-pane").boundingBox(),control=await page.locator(".law-map-attribution").boundingBox();
    assert(control.x+control.width<=pane.x||control.x>=pane.x+pane.width||control.y+control.height<=pane.y||control.y>=pane.y+pane.height,"Attribution overlaps project pane");
    passed.push(prefix+": attribution stays clear of open project pane");
    await page.locator(".law-resident-pane").getByRole("button",{name:"Share",exact:true}).click();
    await page.locator(".law-resident-pane .law-map-notice").waitFor();
    await page.locator(".law-resident-pane").getByRole("button",{name:"Dismiss message",exact:true}).click();
    passed.push(prefix+": project-pane share uses the shared dismissible notice");
   }
  }
  if(publicationCheck||markerCheck||markerToggleCheck||boundaryColorCheck||menuCheck){assert.deepEqual(errors,[],"Browser errors");await context.close();continue;}
  await page.goto(origin+"/notices");await page.getByRole("button",{name:"Show notice",exact:true}).click();
  const notice=page.locator(".law-map-notice"),close=notice.getByRole("button",{name:"Dismiss message"});
  await close.focus();await page.waitForTimeout(4300);assert.equal(await notice.count(),1);
  await page.mouse.move(0,0);await page.getByRole("button",{name:"Show error",exact:true}).focus();await page.waitForTimeout(4200);assert.equal(await notice.count(),0);
  await page.getByRole("button",{name:"Show notice",exact:true}).click();await notice.hover();await page.waitForTimeout(4200);assert.equal(await notice.count(),1);await close.click();assert.equal(await notice.count(),0);
  await page.getByRole("button",{name:"Show error",exact:true}).click();await page.mouse.move(0,0);await page.waitForTimeout(4200);assert.equal(await notice.getByRole("alert").count(),1);await close.click();assert.equal(await notice.count(),0);
  passed.push(prefix+": hover/focus pause, early close, and persistent announced errors");
  if(satelliteCheck)assert(rasterRequests>0,"No USGS imagery tiles requested");assert.deepEqual(errors,[],"Browser errors");await context.close();
 }
 console.log(JSON.stringify({passed:passed.length,failed:0,checks:passed},null,2));
 fs.writeFileSync("output/map-ui-browser-results.json",JSON.stringify({passed:passed.length,failed:0,checks:passed},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
