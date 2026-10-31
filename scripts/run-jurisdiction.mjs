import {spawnSync} from "node:child_process";
if(Number(process.versions.node.split(".")[0])!==24)throw Error("Jurisdiction collection requires Node 24 (PDF.js needs Iterator helpers)");
if(process.env.VERCEL_ENV==="production")throw Error("Production shell runs are forbidden; use the deployed scheduled job");
const generate=spawnSync(process.execPath,["scripts/generate-jurisdictions.mjs"],{stdio:"inherit"});if(generate.status!==0)process.exit(generate.status??1);
const run=spawnSync(process.execPath,["--conditions=react-server","--import","tsx","scripts/jurisdiction.ts",...process.argv.slice(2)],{stdio:"inherit"});process.exit(run.status??1);
