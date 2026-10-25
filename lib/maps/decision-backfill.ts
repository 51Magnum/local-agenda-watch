import {Pool} from "pg";
import {indexedDecisionDate} from "./case-index";
import type {HearingFeed} from "@/lib/localities/types";
import {caseCatalog} from "@/lib/case-catalog";
let pool:Pool|undefined;
export async function backfillDecisionDates(areaId:string,feed?:HearingFeed){
 if(!process.env.DATABASE_URL)return 0;
 pool??=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
 const dates=caseCatalog(feed).flatMap(h=>{const date=indexedDecisionDate(h);return date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?[{id:h.appId,date}]:[];});
 const source=await pool.query("UPDATE law_map_cases c SET data=jsonb_set(c.data,'{decisionDate}',to_jsonb(x.date)) FROM jsonb_to_recordset($2::jsonb) AS x(id text,date text) WHERE c.area_id=$1 AND c.case_id=x.id AND c.data->>'stage' IN ('Decided','Recorded') AND c.data->>'decisionDate' IS NULL",[areaId,JSON.stringify(dates)]);
 const reviewed=await pool.query("UPDATE law_map_cases c SET data=jsonb_set(c.data,'{decisionDate}',to_jsonb(f.date)) FROM (SELECT case_id,max(data->>'value') AS date FROM law_timeline_fields WHERE area_id=$1 AND data->>'key'='decisionDate' AND status='approved' AND data->>'value' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' GROUP BY case_id) f WHERE c.area_id=$1 AND c.case_id=f.case_id AND c.data->>'stage' IN ('Decided','Recorded') AND c.data->>'decisionDate' IS NULL",[areaId]);
 return (source.rowCount??0)+(reviewed.rowCount??0);
}
