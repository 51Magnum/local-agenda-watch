// Boise FLUM browser regression: node --import tsx scripts/check-boise-flum.mjs.
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
const root = process.cwd(), out = path.join(root,"output/boise-flum-browser");
fs.mkdirSync(out,{recursive:true});
const review=JSON.parse(fs.readFileSync("data/review/boise.json","utf8"));
const records=review.records.filter(r=>r.eligible).slice(0,5).map(r=>({id:r.caseId,project:r.project,map:review.map.cases.find(c=>c.id===r.caseId)}));
const boundaries = JSON.parse(fs.readFileSync("public/map-data/boundaries.json","utf8"));
const item = records[0].map, project = records[0].project;

const imageryTile=await sharp({create:{width:256,height:256,channels:3,background:{r:75,g:100,b:65}}}).png().toBuffer();
const area = {id:"boise",name:"Boise",stateAbbreviation:"ID",href:"/us/id/boise",center:[-116.2023,43.615],bounds:[-116.4,43.45,-116.0,43.8],status:"live"};
const landUse=JSON.parse(fs.readFileSync("data/flum/boise.json","utf8"));
const nearbyLandUse={...landUse,geojson:{type:"FeatureCollection",features:landUse.geojson.features.map(f=>({...f,properties:{category:f.properties.LandUse,group:"Mixed use",color:"#d8b4fe",jurisdiction:"City of Boise"}}))}};
const mapData = {jurisdiction:{...area,zoom:13},cases:records.map(r=>r.map),updatedAt:"2026-11-04T12:00:00Z",warnings:[],flum:{legend:landUse.legend,categoryField:"LandUse",layerUrl:"https://official.test/land-use"}};
await build({stdin:{contents:`
import React from 'react'; import {createRoot} from 'react-dom/client';
import Home from './app/components/maps/map-home';
import CaseMap from './app/components/maps/case-map';
const fixture=${JSON.stringify({item,boundaries})};
const route=location.pathname;
createRoot(document.getElementById('root')).render(route==='/home'?<Home/>:route==='/project'?<CaseMap jurisdiction="boise" caseIds={[fixture.item.id]} compact/>:route==='/area'?<CaseMap jurisdiction="boise"/>:route==='/location'?<CaseMap jurisdiction="combined" combined={{country:'us',state:'id'}}/>:<CaseMap jurisdiction="boise"/>);
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
  else if(pathname.startsWith("/flum/")){const file=fs.readFileSync("public"+pathname),range=req.headers.range?.match(/bytes=(\d+)-(\d*)/);if(range){const start=Number(range[1]),end=Math.min(Number(range[2]||file.length-1),file.length-1);res.writeHead(206,{"Content-Type":"application/octet-stream","Accept-Ranges":"bytes","Content-Range":'bytes '+start+'-'+end+'/'+file.length});res.end(file.subarray(start,end+1));}else{res.setHeader("Content-Type","application/octet-stream");res.end(file);}}
  else {res.setHeader("Content-Type","text/html");res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin="http://127.0.0.1:"+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.LAW_PLAYWRIGHT_CHANNEL?{channel:process.env.LAW_PLAYWRIGHT_CHANNEL}:{})}),passed=[];
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,isMobile:mobile}),page=await context.newPage(),errors=[];
  page.on("pageerror",e=>{errors.push(e.message);console.error("Browser:",e.message);});let rasterRequests=0;
  await page.route("**/*",route=>{
   const u=new URL(route.request().url()),url=u.pathname;
   if(u.hostname==="tiles.openfreemap.org")return route.fulfill({json:{version:8,sources:{base:{type:"geojson",data:{type:"FeatureCollection",features:[]}}},layers:[{id:"background",type:"background",paint:{"background-color":"#e2e8f0"}},{id:"base-roads",type:"line",source:"base"},{id:"base-road-labels",type:"symbol",source:"base"},{id:"base-places",type:"symbol",source:"base"}]}});
   if(u.hostname==="basemap.nationalmap.gov"){rasterRequests++;return route.fulfill({contentType:"image/png",headers:{"access-control-allow-origin":"*"},body:imageryTile});}
   if(u.origin!==origin)return route.abort();
   const json=url==="/api/map/meta"?{revision:"boise-flum",areas:[area]}:url==="/api/map/cases"?packViewport({cases:records.map(r=>({...r.map,id:"boise:"+r.id,areaId:"boise"})), summaries:[],truncated:false,updatedAt:mapData.updatedAt,bounds:area.bounds}):url==="/api/map/coverage"?{areas:["Boise"]}:url==="/api/map/project"?project:url==="/api/map/boundaries"?boundaries:url==="/api/maps/nearby"?(u.searchParams.get("layer")==="flum"?nearbyLandUse:{...mapData,flum:{...mapData.flum,categoryField:"category"},areas:[area]}):url==="/api/maps/boise"?(u.searchParams.get("layer")==="flum"?landUse:mapData):url==="/api/account/pins"?{pins:[]}:url.startsWith("/admin/jurisdictions/")?project:undefined;
   if(json)return route.fulfill({json});
   if(url.startsWith("/api/"))return route.fulfill({json:{projects:[],areas:[]}});
   return route.continue();
  });
  const prefix=mobile?"mobile":"desktop";
  for(const view of ["home","project","area","location"]){
   console.log(prefix+": "+view);await page.goto(origin+"/"+view);await page.waitForFunction(()=>window.__lawTestMap?.getLayer("law-satellite-basemap"));
   await page.evaluate(()=>window.__lawTestMap.jumpTo({center:[-116.2023,43.615],zoom:13}));
   if(view==="home")await page.getByRole("button",{name:"Layers",exact:true}).click();else await page.locator(".law-basemap-layers>summary").click();
   await page.getByRole("checkbox",{name:"Future land use",exact:true}).check();
   if(view!=="home")await page.waitForFunction(()=>window.__lawTestMap.getStyle().sources.flum.data.features.length>0);
   await page.evaluate(()=>window.__lawTestMap.jumpTo({center:[-116.2023,43.615],zoom:13}));
   const layer=view==="home"?"law-flum":"flum-fill";
   await page.waitForFunction(id=>{const m=window.__lawTestMap;if(!m.getLayer(id))return false;return m.queryRenderedFeatures(m.project([-116.2023,43.615]),{layers:[id]}).some(f=>(f.properties.category??f.properties.LandUse)==="Downtown Mixed Use");},layer).catch(async e=>{console.log(JSON.stringify(await page.evaluate(id=>{const m=window.__lawTestMap;return {center:m.getCenter().toArray(),zoom:m.getZoom(),loaded:m.loaded(),layer:m.getStyle().layers.find(l=>l.id===id),sources:Object.keys(m.getStyle().sources),features:m.getLayer(id)?m.queryRenderedFeatures({layers:[id]}).slice(0,5).map(f=>f.properties):[]};},layer)));throw e;});
   if(view==="home"){await page.getByRole("checkbox",{name:"Project markers",exact:true}).uncheck();await page.waitForFunction(()=>["law-clusters","law-dots","law-cluster-count","law-summary-dots","law-summary-count"].every(id=>window.__lawTestMap.getLayoutProperty(id,"visibility")==="none"));}
   const before=await page.evaluate(id=>{const m=window.__lawTestMap;return {center:m.getCenter().toArray(),zoom:m.getZoom(),time:performance.timeOrigin,layer:m.getStyle().layers.find(l=>l.id===id)};},layer);
   const group=page.getByRole("group",{name:"Basemap",exact:true});await group.getByRole("button",{name:"Satellite",exact:true}).click();
   await page.waitForFunction(()=>window.__lawTestMap.getLayoutProperty("law-satellite-basemap","visibility")==="visible");
   const after=await page.evaluate(id=>{const m=window.__lawTestMap,layers=m.getStyle().layers;return {center:m.getCenter().toArray(),zoom:m.getZoom(),time:performance.timeOrigin,layer:layers.find(l=>l.id===id),above:layers.findIndex(l=>l.id===id)>layers.findIndex(l=>l.id==="law-satellite-basemap"),matches:m.queryRenderedFeatures(m.project([-116.2023,43.615]),{layers:[id]}).some(f=>(f.properties.category??f.properties.LandUse)==="Downtown Mixed Use")};},layer);
   assert.deepEqual(after.center,before.center);assert.equal(after.zoom,before.zoom);assert.equal(after.time,before.time);assert.deepEqual(after.layer,before.layer);assert(after.above);assert(after.matches);assert.equal(await page.locator(".maplibregl-ctrl-attrib").count(),1);
   await group.getByRole("button",{name:"Map",exact:true}).click();await page.getByRole("checkbox",{name:"Future land use",exact:true}).uncheck();
   await page.waitForFunction(id=>{const m=window.__lawTestMap;return m.queryRenderedFeatures(m.project([-116.2023,43.615]),{layers:[id]}).length===0;},layer);
   passed.push(prefix+": "+view+" renders Boise's official designation, preserves FLUM over Satellite and viewport, and toggles off cleanly");
  }
  assert(rasterRequests>0);assert.deepEqual(errors,[]);await context.close();
 }
 console.log(JSON.stringify({passed:passed.length,failed:0,checks:passed},null,2));fs.writeFileSync("output/boise-flum-browser-results.json",JSON.stringify({passed:passed.length,failed:0,checks:passed},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
