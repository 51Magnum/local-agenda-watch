import {Pool as PgPool,type PoolConfig} from "pg";
import {productionWritesAllowed,requireProductionMutation} from "./runtime-environment";
export type {PoolClient} from "pg";
/** Previews use a separate DSN when supplied and are read-only at the PG session level. */
export class Pool extends PgPool{
 constructor(config:PoolConfig&{previewSignups?:boolean}={}){
  const {previewSignups,...pgConfig}=config,production=productionWritesAllowed();
  const signupDatabase=!production&&previewSignups&&!!process.env.DATABASE_URL_PREVIEW&&process.env.DATABASE_URL_PREVIEW!==process.env.DATABASE_URL;
  const connectionString=production?config.connectionString:(process.env.DATABASE_URL_PREVIEW??config.connectionString);
  super({...pgConfig,connectionString,...!production&&!signupDatabase?{options:(config.options??"")+" -c default_transaction_read_only=on"}:{}});
  const query=this.query.bind(this);
  this.query=((...args:unknown[])=>{
   const sql=typeof args[0]==="string"?args[0]:String((args[0] as {text?:string})?.text??"");
   // Existing schema belongs to migrations/production initialization. Never issue preview DDL.
   if(!production&&/^\s*(?:CREATE|ALTER)\b/i.test(sql))return Promise.resolve({rows:[],rowCount:0,command:"DISABLED_IN_PREVIEW",fields:[]});
   if(!production&&!signupDatabase&&!/^\s*(?:SELECT|WITH|SHOW|EXPLAIN)\b/i.test(sql))requireProductionMutation();
   return Reflect.apply(query,this,args);
  }) as PgPool["query"];
 }
}
