import type {Metadata} from "next";
import {SITE_ORIGIN} from "./site-config";
export function metadataOrigin(){
 if(process.env.VERCEL_ENV==="production")return SITE_ORIGIN;
 const host=process.env.VERCEL_BRANCH_URL??process.env.VERCEL_URL;
 return host?new URL("https://"+host).origin:"http://localhost:3000";
}
export function environmentMetadata():Metadata{
 return {metadataBase:new URL(metadataOrigin()),...process.env.VERCEL_ENV!=="production"?{robots:{index:false,follow:false}}:{}};
}
