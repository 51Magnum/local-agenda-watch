import type {Application} from "./adapters/types";
/** Hearing links override filing age; undated source records never get an invented date. */
export function retainRecentOrHeard(applications:Application[],linked:ReadonlySet<string>,start:string){
 return applications.filter(a=>!a.received||a.received>=start||linked.has(a.recordId));
}
