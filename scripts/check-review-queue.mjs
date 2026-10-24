import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=process.env.PLAYWRIGHT_MODULE_PATH ? require(process.env.PLAYWRIGHT_MODULE_PATH) : require('playwright');
const root=process.cwd(),data=path.join(root,'.data');await mkdir(data,{recursive:true});
const dir=await mkdtemp(path.join(data,'review-ux-test-')),file=path.join(dir,'timeline.json');
const password=randomUUID(),port=Number(process.env.REVIEW_TEST_PORT??3013),origin=`http://localhost:${port}`;
const state={version:1,documents:{},fields:{},audit:[],runs:[],leases:{}};
const quote='Preserve the three existing trees. Council approved the project.';
state.documents.doc={id:'doc',areaId:'star',url:'https://www.staridaho.org/test.pdf',title:'City Council minutes — 2026-09-01',kind:'minutes',caseIds:['DA-26-03'],hash:'test',checkedAt:'',state:'complete',meeting:{body:'City Council',date:'2026-09-01',isHearing:true},pages:[{page:1,text:quote,method:'native'}]};
for(let i=0;i<25;i++){const id='fixture-'+String(i).padStart(2,'0');state.fields[id]={id,areaId:'star',documentId:'doc',documentHash:'test',caseId:'DA-26-03',body:'City Council',key:'councilConditions',value:'Preserve the three existing trees.',sourceUrl:state.documents.doc.url,page:1,quote,confidence:.95,status:'pending',sourceKind:'minutes',createdAt:'2026-10-24',verification:{version:1,case:true,body:true,quote:true,value:true,secondPass:true,reasons:[],checkedAt:'2026-10-24'}};}
await writeFile(file,JSON.stringify(state));
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','-p',String(port)],{cwd:root,env:{...process.env,DATABASE_URL:'',REVIEW_ADMIN_PASSWORD:password,TIMELINE_LOCAL_PATH:file},stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
let browser;
try{
 for(let i=0;i<100;i++){try{await fetch(origin);break;}catch{await new Promise(r=>setTimeout(r,200));}if(i===99)throw Error('Test server did not start');}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({httpCredentials:{username:'admin',password},viewport:{width:1360,height:900}});
 const page=await context.newPage();let navigations=0;page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
 await page.goto(origin+'/admin/review');await page.getByRole('button',{name:'Pending (25)',exact:true}).waitFor();
 const cards=page.locator('article[data-field-id]');assert.equal(await cards.count(),25);
 // Preserve a typed edit through a bulk approval, and select five scattered cards.
 await cards.nth(0).getByRole('textbox',{name:'Extracted value',exact:true}).fill('Preserve all three existing trees.');
 for(let i=5;i<10;i++)await cards.nth(i).getByRole('checkbox').check();
 // Also test an edit in the selected batch.
 await cards.nth(5).getByRole('textbox',{name:'Extracted value',exact:true}).fill('Preserve all three existing trees.');
 const top=page.getByRole('button',{name:'Approve selected',exact:true});
 await page.evaluate(()=>window.scrollTo(0,750));const before=await page.evaluate(()=>window.scrollY),navBefore=navigations;
 await top.click();await page.getByRole('button',{name:'Pending (20)',exact:true}).waitFor();
 await page.waitForFunction(()=>document.activeElement?.getAttribute('data-field-id')==='fixture-10');
 const after=await page.evaluate(()=>window.scrollY);assert.equal(navigations,navBefore);assert.ok(Math.abs(after-before)<5,`Scroll changed from ${before} to ${after}`);
 assert.equal(await cards.count(),20);
 const saved=JSON.parse(await (await import('node:fs/promises')).readFile(file,'utf8'));assert.equal(saved.fields['fixture-05'].value,'Preserve all three existing trees.');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Pending (25)',exact:true}).waitFor();assert.equal(await cards.count(),25);
 // Remove cards above the viewport as well: browser scroll anchoring must not jump.
 for(let i=0;i<5;i++)await cards.nth(i).getByRole('checkbox').check();
 await page.evaluate(()=>window.scrollTo(0,2000));const anchoredBefore=await page.evaluate(()=>window.scrollY);
 await top.click();await page.getByRole('button',{name:'Pending (20)',exact:true}).waitFor();
 await page.waitForFunction(()=>document.activeElement?.getAttribute('data-field-id')==='fixture-05');
 const anchoredAfter=await page.evaluate(()=>window.scrollY);assert.ok(Math.abs(anchoredAfter-anchoredBefore)<5,`Anchoring jumped ${anchoredBefore} -> ${anchoredAfter}`);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Pending (25)',exact:true}).waitFor();
 // Keyboard shortcut operates on focused cards, not textareas; reject and undo.
 await cards.nth(12).focus();await page.keyboard.press('x');assert.match(await page.getByText('1 selected',{exact:true}).innerText(),/1/);await page.keyboard.press('r');await page.getByRole('button',{name:'Pending (24)',exact:true}).waitFor();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Pending (25)',exact:true}).waitFor();
 await page.getByRole('button',{name:'Select all passing checks',exact:true}).click();assert.equal(await page.getByText('23 selected',{exact:true}).count(),1);
 await page.getByRole('button',{name:'Clear',exact:true}).click();await page.getByRole('checkbox',{name:'Select all on page',exact:true}).check();assert.equal(await page.getByText('25 selected',{exact:true}).count(),1);
 await page.getByRole('button',{name:'Clear',exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));
 await mkdir(path.join(root,'output'),{recursive:true});await page.screenshot({path:path.join(root,'output','review-queue-verified.png')});
 const report={pendingFixture:25,bulkApproved:5,editedValueSaved:true,pageReloadsDuringBulk:navigations-navBefore,scrollBefore:before,scrollAfter:after,anchoredBefore,anchoredAfter,nextFocused:'fixture-10',undoRestored:25,keyboardRejectAndUndo:true,passingSelectionExcludesEdits:true};
 await writeFile(path.join(root,'output','review-queue-ux-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} catch(error){console.error(log.slice(-3000));throw error;}finally{
 await browser?.close();server.kill();await new Promise(r=>server.once('exit',r));
 // Delete only this run's generated file and empty test directory.
 if(path.dirname(dir)===data&&path.basename(dir).startsWith('review-ux-test-')){await unlink(file);await rmdir(dir);}
}
