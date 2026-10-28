import {spawnSync} from "node:child_process";
const generate=spawnSync(process.execPath,["scripts/generate-jurisdictions.mjs"],{stdio:"inherit"});if(generate.status!==0)process.exit(generate.status??1);
const run=spawnSync(process.execPath,["--import","tsx","scripts/jurisdiction.ts",...process.argv.slice(2)],{stdio:"inherit"});process.exit(run.status??1);
