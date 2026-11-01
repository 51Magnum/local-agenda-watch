// Run against a local snapshot Preview: LAW_PREVIEW_URL=http://localhost:3082 node scripts/check-project-clicks.mjs.
// Install Playwright or set LAW_PLAYWRIGHT_MODULE to an existing installation. No production mutations or AI calls.
import fs from "node:fs";
import {packViewport} from "../lib/maps/viewport-wire.ts";
import {createRequire} from "node:module";
import assert from "node:assert/strict";
const {chromium}=createRequire(import.meta.url)(process.env.LAW_PLAYWRIGHT_MODULE??"playwright");
const base=process.env.LAW_PREVIEW_URL??"http://localhost:3082";
assert(["localhost","127.0.0.1"].includes(new URL(base).hostname),"This check runs only against a local server");
const review=JSON.parse(fs.readFileSync("data/review/ada-county.json","utf8"));
// Public record responses and cached source polygons; Preview never opens a legacy database.
const nampa=JSON.parse(fs.readFileSync("tests/fixtures/nampa-map-clicks.json","utf8"));
const cases=[...['201601258-CPA','202300565-CU','202600638-ZC','202600819-ZC','202601987-CU'].map(id=>({area:"ada-county",item:review.map.cases.find(c=>c.id===id)})),...nampa.map(r=>({area:"nampa",item:r.map}))];
const root="docs/jurisdictions/screenshots/2026-10-31-project-fill-clicks";
fs.mkdirSync(root,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const mobile of [false,true])for(const {area,item} of mobile?cases.filter(c=>c.item.id==='202600638-ZC'):cases)for(const zoom of mobile?[15]:[13,15]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile}),errors=[],requests=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{if(r.url().includes('/api/map/cases?'))requests.push(Number(new URL(r.url()).searchParams.get('zoom')));});
  if(area==="nampa"){
   await page.route("**/api/map/cases?*",route=>route.fulfill({json:packViewport({cases:nampa.map(r=>({...r.map,id:"nampa:"+r.id,areaId:"nampa"})),summaries:[],truncated:false,updatedAt:"2026-10-31",bounds:[-117,43,-116,44]})}));
   await page.route("**/api/map/project?*",route=>{const id=new URL(route.request().url()).searchParams.get('case'),r=nampa.find(r=>r.id===id);return r?route.fulfill({json:r.project}):route.continue();});
  }
  await page.addInitScript(view=>{localStorage.clear();localStorage.setItem("law:map-view:v1",JSON.stringify(view));},{center:item.centroid,zoom});
  await page.goto(base,{waitUntil:"networkidle",timeout:90000});
  await page.locator('.maplibregl-canvas').waitFor();await page.waitForTimeout(1200);
  assert(requests.includes(zoom),`Viewport did not request zoom ${zoom}`);
  const box=await page.locator('.maplibregl-canvas').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  // The camera starts on this geometry's area-weighted centroid; click/tap the canvas center, away from edges.
  if(mobile)await page.touchscreen.tap(x,y);else {await page.mouse.move(x,y);await page.mouse.click(x,y);}
  const pane=page.locator('.law-resident-pane');await pane.waitFor({state:'visible',timeout:15000});
  assert.equal(new URL(page.url()).searchParams.get('project'),area+'/'+item.id);
  assert.equal(errors.length,0,errors.join('\n'));
  const result={area,id:item.id,zoom,mobile,centroid:item.centroid,geometry:item.geometry.type,parts:item.geometry.type==='MultiPolygon'?item.geometry.coordinates.length:1,pass:true};results.push(result);console.log(JSON.stringify(result));
  if(item.id==='202600638-ZC'&&zoom===15){await page.waitForTimeout(800);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${root}/ada-center-pane-${mobile?'390x844':'1440x900'}.png`});}
  await page.close();
 }
 fs.writeFileSync(`${root}/results.json`,JSON.stringify(results,null,2)+'\n');
}finally{await browser.close();}
