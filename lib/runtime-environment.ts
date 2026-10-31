export const isPreview=()=>process.env.VERCEL_ENV==="preview";
export const productionWritesAllowed=()=>process.env.VERCEL_ENV==="production";
/** A preview has no database target, even when production variables are inherited. */
export const databaseUrl=()=>productionWritesAllowed()?process.env.DATABASE_URL:undefined;
export function requireProductionMutation(){if(!productionWritesAllowed())throw Error("Writes are disabled outside production (including previews)");}
export const requireOnboardingMutation=requireProductionMutation;
export function previewMutationResponse(){return productionWritesAllowed()?undefined:Response.json({error:"Not available in preview; writes are disabled in preview and production data was not changed"},{status:403,headers:{"Cache-Control":"no-store"}});}
