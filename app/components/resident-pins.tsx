import type {ResidentPin} from "@/lib/resident-account";
import {pinLimit,type ResidentPlan} from "@/lib/plan-policy";

function PinForm({pin,plan,returnTo}:{pin?:ResidentPin;plan:ResidentPlan;returnTo:string}){
 return <form action="/api/account/pins" method="post" className="grid gap-3">
  <input type="hidden" name="id" value={pin?.id??""}/><input type="hidden" name="source" value="saved"/><input type="hidden" name="returnTo" value={returnTo}/>
  <label>Pin name<input className="block w-full rounded border p-2" name="label" maxLength={300} required defaultValue={pin?.label??""}/></label>
  <div className="grid gap-3 sm:grid-cols-2"><label>Longitude<input className="block w-full rounded border p-2" type="number" step="any" min={-180} max={180} required name="longitude" defaultValue={pin?.coordinates[0]}/></label><label>Latitude<input className="block w-full rounded border p-2" type="number" step="any" min={-85} max={85} required name="latitude" defaultValue={pin?.coordinates[1]}/></label></div>
  {plan==="free"?<><p>Radius: 1 mile (locked on Free)</p><input type="hidden" name="radiusMiles" value="1"/></>:<label>Radius in miles<input className="block w-full rounded border p-2" type="number" step="any" min={.25} max={10} required name="radiusMiles" defaultValue={pin?.radiusMiles??1}/></label>}
  <label><input type="checkbox" name="alertsEnabled" defaultChecked={!!pin?.alertsEnabled}/> Email me project updates and hearing reminders for this pin</label>
  <p className="text-sm">Email alerts start only when you select this option. Projects matching several pins appear once in your combined updates.</p>
  <button className="justify-self-start rounded bg-teal-700 px-4 py-3 text-white">{pin?.id?pin.archived?"Activate pin":"Save changes":"Save pin"}</button>
 </form>;
}
export default function ResidentPins({pins,plan,draft,returnTo="/profile"}:{pins:ResidentPin[];plan:ResidentPlan;draft?:ResidentPin;returnTo?:string}){
 const active=pins.filter(p=>!p.archived).length;
 return <section className="space-y-5"><h2 className="text-2xl font-semibold">Your pins</h2><p>Plan: <strong>{plan==="paid"?"Paid":"Free"}</strong> · {active} of {pinLimit(plan)} active pins</p>
  {plan==="free"?<p>Free includes one pin with a 1 mile radius. Upgrade to Paid for up to {pinLimit("paid")} pins and a radius of 0.25–10 miles per pin. Upgrades are handled by an administrator; payments are not available yet.</p>:<p>Choose a radius of 0.25–10 miles for each pin. Plan changes are handled by an administrator.</p>}
  <p>Your pin locations and labels are private to your account.</p>
  {pins.map(pin=><article className="space-y-4 rounded border p-5" key={pin.id}><h3 className="text-xl font-semibold">{pin.label}</h3><p>{pin.archived?"Inactive: retained from your previous pins. Delete an active pin or upgrade before activating this one.":pin.alertsEnabled?"Email alerts are on.":"Saved privately; email alerts are off."}</p>
   {(!pin.archived||active<pinLimit(plan))&&<PinForm pin={pin} plan={plan} returnTo={returnTo}/>}
   <form action="/api/account/pins" method="post"><input type="hidden" name="id" value={pin.id}/><input type="hidden" name="source" value="saved"/><input type="hidden" name="returnTo" value={returnTo}/><button className="underline" name="action" value="remove">Delete pin{pin.alertsEnabled?" and stop its emails":""}</button></form>
  </article>)}
  {active<pinLimit(plan)?<section className="space-y-4 rounded border p-5"><h3 className="text-xl font-semibold">Add a pin</h3><p>Choose “Save this pin” on the public map, or enter coordinates here.</p><PinForm pin={draft} plan={plan} returnTo={returnTo}/></section>:<p>Your plan’s pin allowance is full. Edit or delete an existing pin to make room.</p>}
 </section>;
}
