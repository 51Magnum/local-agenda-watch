import{saveCoverageRequest}from"@/lib/areas/requests";
export const runtime="nodejs";
export async function POST(request:Request){
  const headers={"Cache-Control":"no-store"};
  try{
    const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==new URL(request.url).host)return Response.json({error:"Please submit this form from the site."},{status:403,headers});
    const text=await request.text();if(text.length>8000)return Response.json({error:"Request too long."},{status:400,headers});let data;
    try{data=JSON.parse(text);}catch{return Response.json({error:"Invalid request."},{status:400,headers});}
    if(!data||typeof data!=="object"||Array.isArray(data))return Response.json({error:"Invalid request."},{status:400,headers});
    if(data.website)return Response.json({ok:true},{headers});
    if(!["coverage","follow"].includes(data.kind))return Response.json({error:"Invalid request."},{status:400,headers});
    const areaRequested=typeof data.areaRequested==="string"?data.areaRequested.trim():"";
    const email=typeof data.email==="string"?data.email.trim():"";
    if(data.kind==="follow"&&!email)return Response.json({error:"Enter an email address to join the alert waitlist."},{status:400,headers});
    if(!areaRequested||areaRequested.length>160||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return Response.json({error:"Enter an area name and, optionally, a valid email."},{status:400,headers});
    for(const field of ["address","interests"])if(data[field]!=null&&typeof data[field]!=="string")return Response.json({error:"Enter a text location and interests."},{status:400,headers});
    const address=typeof data.address==="string"?data.address.trim():"",interests=typeof data.interests==="string"?data.interests.trim():"";
    if(address.length>300||interests.length>1000)return Response.json({error:"Keep the location under 300 characters and interests under 1,000 characters."},{status:400,headers});
    let location=null;if(data.location!=null){const{lat,lng}=data.location;if(typeof lat!=="number"||typeof lng!=="number"||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return Response.json({error:"Invalid location."},{status:400,headers});location={lat,lng};}
    const radiusMiles=data.radiusMiles??1;
    if(typeof radiusMiles!=="number"||!Number.isFinite(radiusMiles)||radiusMiles<.25||radiusMiles>10)return Response.json({error:"Choose a radius from 0.25 to 10 miles."},{status:400,headers});
    await saveCoverageRequest({kind:data.kind,areaRequested,location,...(data.kind==="follow"&&location?{radiusMiles,jurisdictionScope:"radius" as const}:{}),email:email||null,address:address||null,interests:interests||null,createdAt:new Date().toISOString()});return Response.json({ok:true},{status:201,headers});
  }catch{return Response.json({error:"We couldn't save this yet. Please try again."},{status:503,headers});}
}
