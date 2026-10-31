export const productionWritesAllowed=()=>process.env.VERCEL_ENV==="production";
/** Preview and explicit CLI targets can never inherit the production connection. */
export function databaseUrl(){
 if(process.env.LAW_DB_TARGET&&process.env.LAW_DB_TARGET!=="preview")throw Error("LAW_DB_TARGET must be preview");
 if(process.env.VERCEL_ENV==="preview"||process.env.LAW_DB_TARGET==="preview"){
  const target=process.env.DATABASE_URL_PREVIEW,production=process.env.DATABASE_URL;
  if(!target||target===production)throw Error("A separate DATABASE_URL_PREVIEW is required");
  const candidate=new URL(target),prod=production?new URL(production):undefined;
  const branch=(u:URL|undefined,fallback:string|undefined)=>u?.searchParams.get("branch_id")??u?.searchParams.get("branch")??u?.searchParams.get("options")?.match(/\bbranch(?:_id)?=([^\s]+)/)?.[1]??fallback;
  const previewBranch=branch(candidate,process.env.DATABASE_PREVIEW_BRANCH_ID),productionBranch=branch(prod,process.env.DATABASE_BRANCH_ID);
  if(previewBranch&&productionBranch&&previewBranch===productionBranch)throw Error("Preview database branch matches production");
  if(process.env.LAW_DB_TARGET==="preview"&&(!prod||!previewBranch||!productionBranch))throw Error("Preview CLI requires the production comparison URL and distinct DATABASE_BRANCH_ID / DATABASE_PREVIEW_BRANCH_ID values");
  const host=(u:URL)=>u.hostname.replace(/-pooler(?=\.)/,"");
  if(prod&&(host(candidate)===host(prod)||candidate.searchParams.get("options")?.match(/endpoint=([^\s]+)/)?.[1]&&candidate.searchParams.get("options")?.match(/endpoint=([^\s]+)/)?.[1]===prod.searchParams.get("options")?.match(/endpoint=([^\s]+)/)?.[1]))throw Error("Preview database host/branch matches production");
  return target;
 }
 return productionWritesAllowed()?process.env.DATABASE_URL:undefined;
}
export function requireOnboardingMutation(){
 if(productionWritesAllowed()&&process.env.LAW_DB_TARGET!=="preview")return;
 if(process.env.LAW_DB_TARGET==="preview"&&process.env.VERCEL_ENV!=="production"){
  const u=new URL(databaseUrl()!);console.info("Onboarding write target: "+u.hostname+u.pathname+" (credentials redacted)");return;
 }
 throw Error("Onboarding writes disabled: shell writes require LAW_DB_TARGET=preview and a separate preview database");
}
export function requireProductionMutation(){
 if(!productionWritesAllowed())throw Error("Writes are disabled outside production (including previews)");
}
export function previewMutationResponse(){
 return productionWritesAllowed()?undefined:Response.json({error:"This operation is disabled in preview; production data was not changed"},{status:403,headers:{"Cache-Control":"no-store"}});
}
