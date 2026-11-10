export const isPreview=()=>process.env.VERCEL_ENV==="preview";
export const isReadOnly=()=>process.env.LAW_READ_ONLY==="true";
export const productionWritesAllowed=()=>process.env.VERCEL_ENV==="production"&&!isReadOnly();
/** A preview has no database target, even when production variables are inherited. */
export const databaseUrl=()=>!isPreview()&&(productionWritesAllowed()||isReadOnly())?process.env.DATABASE_URL:undefined;
export function requireProductionMutation(){if(!productionWritesAllowed())throw Error("Writes are disabled outside production (including previews) and in read-only mode");}
export const requireOnboardingMutation=requireProductionMutation;
export function previewMutationResponse(){return productionWritesAllowed()?undefined:Response.json({error:"Not available in preview; writes are disabled in preview and production data was not changed"},{status:403,headers:{"Cache-Control":"no-store"}});}
