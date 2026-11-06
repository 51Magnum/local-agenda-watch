export type OfficialRedirect={host:string;fromPath:string;toPath:string;requiredQuery?:string[];query?:Record<string,string>};
export function officialRedirect(from:string,to:string,rules:readonly OfficialRedirect[]=[]){
 try{const a=new URL(from),b=new URL(to,from);return a.protocol==="https:"&&b.origin===a.origin&&!b.username&&!b.password&&rules.some(r=>r.host===a.hostname&&r.fromPath.toLowerCase()===a.pathname.toLowerCase()&&r.toPath.toLowerCase()===b.pathname.toLowerCase()&&(r.requiredQuery??[]).every(k=>!!b.searchParams.get(k))&&Object.entries(r.query??{}).every(([k,v])=>b.searchParams.get(k)===v))?b.href:undefined;}catch{return;}
}
