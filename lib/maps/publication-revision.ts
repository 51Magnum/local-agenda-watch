import {createHash} from "node:crypto";
/** Publication authority is read outside the data cache, including pauses/resumes. */
export function mapPublicationRevision(revision:string,areas:readonly {id:string;boundaryRevision?:string}[]){
 return createHash("sha256").update(JSON.stringify([revision,areas.map(a=>[a.id,a.boundaryRevision??""]).sort((a,b)=>a[0].localeCompare(b[0]))])).digest("hex").slice(0,24);
}
