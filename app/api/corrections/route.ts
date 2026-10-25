import {sameOrigin} from "@/lib/timeline/auth";
import {saveCorrection} from "@/lib/corrections";
export async function POST(request:Request){
 const headers={"Cache-Control":"no-store"};
 if(!sameOrigin(request))return Response.json({error:"Submit from our site."},{status:403,headers});
 if(Number(request.headers.get("content-length"))>16384)return Response.json({error:"Report too long."},{status:413,headers});
 let data;try{const body=await request.text();if(body.length>16384)throw Error();data=JSON.parse(body);if(!data||typeof data!=="object")throw Error();}catch{return Response.json({error:"Invalid report."},{status:400,headers});}
 if(typeof data.website==="string"&&data.website.trim())return Response.json({ok:true},{status:201,headers});
 const project=typeof data.project==="string"?data.project.trim():"",message=typeof data.message==="string"?data.message.trim():"",email=typeof data.email==="string"?data.email.trim():"";
 if(!project||project.length>200||message.length<5||message.length>3000||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return Response.json({error:"Enter a project and description (5–3,000 characters), and a valid email if provided."},{status:400,headers});
 try{const ip=(request.headers.get("x-vercel-forwarded-for")??request.headers.get("x-forwarded-for")??"unknown").split(",")[0].trim(),result=await saveCorrection({project,message,email:email||null},ip);return result.limited?Response.json({error:"Up to five reports per hour. Please try later."},{status:429,headers:{...headers,"Retry-After":"3600"}}):Response.json({ok:true,id:result.id},{status:201,headers});}catch{console.error("[corrections] Storage unavailable");return Response.json({error:"Could not save. Email corrections@localagendawatch.com."},{status:503,headers});}
}
