export const productionWritesAllowed=()=>process.env.VERCEL_ENV==="production";
export const databaseUrl=()=>productionWritesAllowed()?process.env.DATABASE_URL:(process.env.DATABASE_URL_PREVIEW??process.env.DATABASE_URL);
export function requireProductionMutation(){
 if(!productionWritesAllowed())throw Error("Writes are disabled outside production (including previews)");
}
export function previewMutationResponse(){
 return productionWritesAllowed()?undefined:Response.json({error:"This operation is disabled in preview; production data was not changed"},{status:403,headers:{"Cache-Control":"no-store"}});
}
