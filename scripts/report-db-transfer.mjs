import {Pool} from "pg";
// Build diagnostics use the app's configured database connection and print aggregate sizes only.
if(process.env.VERCEL_ENV==="production"&&process.env.DATABASE_URL){
 const db=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
 try{
  const r=await db.query("SELECT data->>'startedAt' AS started, data->>'finishedAt' AS finished, data->'transfer' AS transfer FROM law_timeline_runs WHERE data ? 'transfer' ORDER BY id DESC LIMIT 2");
  for(const row of r.rows)console.info("[timeline:previous-transfer]",JSON.stringify(row));
 }catch(error){console.info("[timeline:previous-transfer]",JSON.stringify({unavailable:true,code:/^[A-Z0-9]+$/.test(error.code??"")?error.code:undefined}));}
 finally{await db.end();}
}
