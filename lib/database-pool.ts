import {Pool as PgPool,type PoolConfig} from "pg";
import {isPreview,productionWritesAllowed,requireProductionMutation} from "./runtime-environment";
export type {PoolClient} from "pg";
/** Defense in depth: no preview code may even construct a database pool. */
export class Pool extends PgPool{
 constructor(config:PoolConfig&{previewSignups?:boolean}={}){
  if(isPreview())throw Error("Database pools are not available in preview; use committed review snapshots");
  const {previewSignups,...pgConfig}=config;void previewSignups;
  const production=productionWritesAllowed();
  super({...pgConfig,...!production?{options:(config.options??"")+" -c default_transaction_read_only=on"}:{}});
  const query=this.query.bind(this);
  this.query=((...args:unknown[])=>{
   const sql=typeof args[0]==="string"?args[0]:String((args[0] as {text?:string})?.text??"");
   if(!production&&/^\s*(?:CREATE|ALTER)\b/i.test(sql))return Promise.resolve({rows:[],rowCount:0,command:"DISABLED_OUTSIDE_PRODUCTION",fields:[]});
   if(!production&&!/^\s*(?:SELECT|WITH|SHOW|EXPLAIN)\b/i.test(sql))requireProductionMutation();
   return Reflect.apply(query,this,args);
  }) as PgPool["query"];
 }
}
