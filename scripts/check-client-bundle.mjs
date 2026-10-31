import {readdir,readFile} from "node:fs/promises";
import path from "node:path";
const root=path.resolve(process.argv[2]??".next/static");
async function files(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
const registryFiles=await readdir("lib/jurisdictions/registry"),privateIds=[];for(const file of registryFiles.filter(f=>f.endsWith(".json"))){const d=JSON.parse(await readFile("lib/jurisdictions/registry/"+file,"utf8"));if((!d.enabled||d.launchStatus!=="public")&&!(process.env.VERCEL_ENV==="preview"&&(await readdir("data/review")).includes(d.id+".json")))privateIds.push(d.id);}
const forbidden=[...privateIds.map(id=>process.env.VERCEL_ENV==="preview"?new RegExp(`(?:id|slug)["']?:["']${id}["']`,"i"):new RegExp("\\b"+id+"\\b","i")),/AdaFileBrowse/i,/backfillUsd/,/escribemeetings\.com/i,/iqm2\.com/i];
for(const name of ["ada-county","ada-county-jurisdiction"]){const geometry=JSON.parse(await readFile(`lib/areas/boundaries/${name}.json`,"utf8"));const coordinates=geometry.coordinates??geometry.geometry?.coordinates;if(coordinates){const signature=JSON.stringify(coordinates).slice(0,200);forbidden.push(new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));}}
const failures=[];let count=0;
for(const file of await files(root)){if(!/\.(?:js|json|map)$/.test(file))continue;count++;const text=await readFile(file,"utf8");for(const pattern of forbidden)if(pattern.test(text))failures.push({file:path.relative(root,file),pattern:String(pattern)});}
if(failures.length){console.error("Client bundle isolation FAILED",JSON.stringify(failures,null,2));process.exitCode=1;}else console.log(`Client bundle isolation PASS: ${count} static files; no private jurisdiction IDs, source hosts, cost caps or Ada boundary content.`);
