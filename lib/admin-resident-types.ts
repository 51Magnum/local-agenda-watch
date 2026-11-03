import type {ResidentPlan} from "./plan-policy";
export type AdminResident={id:string;email:string;plan:ResidentPlan;activePins:number;inactivePins:number;createdAt:string;lastSignInAt:string|null};
export type AdminResidentSearch={residents:AdminResident[];hasMore:boolean};
export type AdminResidentPin={id:string;label:string;radiusMiles:number;active:boolean;alertsEnabled:boolean};
export type AdminPlanChange={id:string;residentId:string|null;email:string|null;actor:string;action:string;oldPlan:ResidentPlan;newPlan:ResidentPlan;createdAt:string};
export function adminResidentTime(value:string|null){
 if(!value)return "Not recorded";
 return new Intl.DateTimeFormat("en-US",{timeZone:"America/Denver",month:"long",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(value));
}
