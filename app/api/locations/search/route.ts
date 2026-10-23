import { usState } from "@/lib/areas/us-states";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"};
export async function POST(request:Request){
  try{
    const data=await request.json();const query=typeof data.query==="string"?data.query.trim():"";const country=data.country??"us";
    if(query.length<2||query.length>200)return Response.json({error:"Enter an address or city."},{status:400,headers});
    if(country!=="us")return Response.json({error:"Address search is available in the United States for now."},{status:422,headers});
    const params=new URLSearchParams({address:query,benchmark:"Public_AR_Current",format:"json"});
    const response=/\d/.test(query)?await fetch("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?"+params,{cache:"no-store",signal:AbortSignal.timeout(8000)}):null;
    if(response&&!response.ok)throw new Error("Geocoder unavailable");
    const json=response?await response.json():{};
    let results=(json.result?.addressMatches??[]).filter((m:{coordinates?:{x:number;y:number}})=>m.coordinates&&Number.isFinite(m.coordinates.x)&&Number.isFinite(m.coordinates.y)&&Math.abs(m.coordinates.x)<=180&&Math.abs(m.coordinates.y)<=90).map((m:{matchedAddress:string;coordinates:{x:number;y:number}})=>({label:m.matchedAddress,coordinates:[m.coordinates.x,m.coordinates.y]}));
    // Census onelineaddress requires a street number. Its place layer handles city-only searches.
    if(!results.length&&!/^\d/.test(query)){
      const parts=query.split(",");
      const state=usState(parts[1]??"");
      const city=parts[0].trim().replace(/\s+(?:city)$/i,"").replace(/'/g,"''").toUpperCase();
      const q=new URLSearchParams({where:"UPPER(BASENAME) = '"+city+"'"+(state?" AND STATE = '"+state.fips+"'":""),outFields:"NAME,STATE,INTPTLAT,INTPTLON",returnGeometry:"false",f:"json",resultRecordCount:"15"});
      const places=await fetch("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4/query?"+q,{cache:"no-store",signal:AbortSignal.timeout(6500)});
      if(places.ok){const p=await places.json();if(p.error)throw new Error("Place search unavailable");results=(p.features??[]).map((f:{attributes:Record<string,string>})=>({label:[f.attributes.NAME,usState(f.attributes.STATE)?.abbreviation].filter(Boolean).join(", "),coordinates:[Number(f.attributes.INTPTLON),Number(f.attributes.INTPTLAT)]})).filter((p:{coordinates:number[]})=>p.coordinates.every(Number.isFinite)&&Math.abs(p.coordinates[0])<=180&&Math.abs(p.coordinates[1])<=90);}
    }
    return Response.json({results:results.slice(0,8)},{headers});
  }catch{return Response.json({error:"Address search is temporarily unavailable. You can choose a covered area below."},{status:503,headers});}
}

