// Local browser regression: node scripts/check-map-ui.mjs.
// Uses Playwright (or LAW_PLAYWRIGHT_MODULE), esbuild from tsx, and committed public fixtures.
// No database, authentication secrets, email, AI, or external requests are used.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {build} from "esbuild";
import {packViewport} from "../lib/maps/viewport-wire.ts";
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.LAW_PLAYWRIGHT_MODULE ?? "playwright");
const root = process.cwd(), out = path.join(root,"output/map-ui-browser");
fs.mkdirSync(out,{recursive:true});
const records = JSON.parse(fs.readFileSync("tests/fixtures/nampa-map-clicks.json","utf8"));
const boundaries = JSON.parse(fs.readFileSync("public/map-data/boundaries.json","utf8"));
const item = records[0].map, project = records[0].project;
const area = {id:"nampa",name:"Nampa",stateAbbreviation:"ID",href:"/us/id/nampa",center:item.centroid,bounds:[-117,43,-116,44],status:"live"};
const mapData = {jurisdiction:{...area,zoom:13},cases:records.map(r=>r.map),updatedAt:"2026-11-04T12:00:00Z",warnings:[],flum:{legend:[],categoryField:"category"}};
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
`,resolveDir:root,loader:"tsx"},outfile:path.join(out,"app.js"),bundle:true,format:"esm",platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"',"process.env":"{}"},alias:{"@":root},logLevel:"silent"});
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
  page.on("pageerror",e=>{errors.push(e.message);console.error("Browser:",e.message);});
  await page.route("**/*",route=>{
   const u=new URL(route.request().url()),url=u.pathname;
   if(u.hostname==="tiles.openfreemap.org")return route.fulfill({json:{version:8,sources:{},layers:[{id:"background",type:"background",paint:{"background-color":"#e2e8f0"}}]}});
   if(u.origin!==origin)return route.abort();
   const json=url==="/api/map/meta"?{revision:"fixture",areas:[area]}:url==="/api/map/cases"?packViewport({cases:records.map(r=>({...r.map,id:"nampa:"+r.id,areaId:"nampa"})),summaries:[],truncated:false,updatedAt:mapData.updatedAt,bounds:area.bounds}):url==="/api/map/coverage"?{areas:["Nampa"]}:url==="/api/map/project"?project:url==="/api/map/boundaries"?boundaries:url==="/api/maps/nampa"?mapData:url==="/api/account/pins"?{pins:Array.from({length:5},(_,i)=>({id:"fixture-"+i,label:"Test pin "+(i+1),coordinates:[item.centroid[0]+i*.002,item.centroid[1]],radiusMiles:1,alertsEnabled:false}))}:url.startsWith("/admin/jurisdictions/")?project:undefined;
   if(json)return route.fulfill({json});
   if(url.startsWith("/api/"))return route.fulfill({json:{projects:[],areas:[]}});
   return route.continue();
  });
  const prefix=mobile?"mobile":"desktop";
  for(const view of ["home","project","area","coverage","admin"]){
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
   if(view==="home"){
    await page.getByRole("button",{name:"Layers",exact:true}).click();await page.getByRole("button",{name:/1\. Test pin 1/}).waitFor();
    for(let i=1;i<=5;i++)await page.getByRole("button",{name:new RegExp(i+"\\. Test pin "+i)}).click();
    await page.getByRole("button",{name:"Layers",exact:true}).click();
    assert.equal(await page.locator(".maplibregl-ctrl-attrib").count(),1);passed.push(prefix+": all five saved pins selectable without duplicate attribution");
    await page.getByRole("button",{name:"Clear pin & circle",exact:true}).first().click();
    const notice=page.locator(".law-map-notice");await notice.filter({hasText:"Pin and circle cleared."}).waitFor();
    await page.mouse.move(0,0);await page.waitForTimeout(4200);assert.equal(await notice.count(),0);passed.push(prefix+": pin-cleared notice automatically dismisses");
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
  await page.goto(origin+"/notices");await page.getByRole("button",{name:"Show notice",exact:true}).click();
  const notice=page.locator(".law-map-notice"),close=notice.getByRole("button",{name:"Dismiss message"});
  await close.focus();await page.waitForTimeout(4300);assert.equal(await notice.count(),1);
  await page.mouse.move(0,0);await page.getByRole("button",{name:"Show error",exact:true}).focus();await page.waitForTimeout(4200);assert.equal(await notice.count(),0);
  await page.getByRole("button",{name:"Show notice",exact:true}).click();await notice.hover();await page.waitForTimeout(4200);assert.equal(await notice.count(),1);await close.click();assert.equal(await notice.count(),0);
  await page.getByRole("button",{name:"Show error",exact:true}).click();await page.mouse.move(0,0);await page.waitForTimeout(4200);assert.equal(await notice.getByRole("alert").count(),1);await close.click();assert.equal(await notice.count(),0);
  passed.push(prefix+": hover/focus pause, early close, and persistent announced errors");
  assert.deepEqual(errors,[],"Browser errors");await context.close();
 }
 console.log(JSON.stringify({passed:passed.length,failed:0,checks:passed},null,2));
 fs.writeFileSync("output/map-ui-browser-results.json",JSON.stringify({passed:passed.length,failed:0,checks:passed},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
