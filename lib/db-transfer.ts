import {AsyncLocalStorage} from "node:async_hooks";
type Transfer={readBytes:number;readQueries:number;byStore:Record<string,number>};
const context=new AsyncLocalStorage<Transfer>();
export function withDbTransfer<T>(work:()=>Promise<T>){return context.run({readBytes:0,readQueries:0,byStore:{}},work);}
export function trackedRows<T>(scope:string,rows:T):T{const metric=context.getStore();if(metric){const bytes=Buffer.byteLength(JSON.stringify(rows));metric.readBytes+=bytes;metric.readQueries++;metric.byStore[scope]=(metric.byStore[scope]??0)+bytes;}return rows;}
export function currentDbTransfer(){const value=context.getStore();return value?structuredClone(value):undefined;}
