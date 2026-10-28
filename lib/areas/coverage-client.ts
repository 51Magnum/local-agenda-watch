type Coverage={area?:{id:string};mapUrl?:string};
const requests=new Map<string,Promise<Coverage>>();
async function coverage(coordinates:[number,number],radius:number):Promise<Coverage>{
 const key=JSON.stringify([coordinates,radius]);let request=requests.get(key);
 if(!request){request=fetch("/api/map/coverage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({coordinates,radius})}).then(async r=>{if(!r.ok)throw Error("Coverage unavailable");return r.json();});requests.set(key,request);if(requests.size>30)requests.delete(requests.keys().next().value!);void request.catch(()=>requests.delete(key));}
 return request;
}
export async function liveAreaAtPoint(coordinates:[number,number]){try{return(await coverage(coordinates,1)).area;}catch{return undefined;}}
export async function locationMapUrl(coordinates:[number,number],address?:string,radius=1){try{const url=(await coverage(coordinates,radius)).mapUrl;if(!url)return;return url+(address?"&q="+encodeURIComponent(address.slice(0,200)):"");}catch{return undefined;}}
