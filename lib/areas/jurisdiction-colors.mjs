/** Stable, contrast-checked defaults. No model, service, or hand-picked config is needed. */
export function automaticJurisdictionColor(id, attempt=0){
 let hash=2166136261;for(const c of String(id)+":"+attempt)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 hash=Math.imul(hash^(hash>>>16),0x85ebca6b);hash=Math.imul(hash^(hash>>>13),0xc2b2ae35);hash=(hash^(hash>>>16))>>>0;
 const hue=(hash%3600)/10,saturation=.62+((hash>>>16)%19)/100;
 for(let light=.4;light>=.15;light-=.01){
  const a=saturation*Math.min(light,1-light),channel=n=>{const k=(n+hue/30)%12;return light-a*Math.max(-1,Math.min(k-3,9-k,1));};
  const rgb=[channel(0),channel(8),channel(4)].map(n=>Math.round(n*255)),linear=rgb.map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});
  if(1.05/(.2126*linear[0]+.7152*linear[1]+.0722*linear[2]+.05)>=4.5)return "#"+rgb.map(n=>n.toString(16).padStart(2,"0")).join("");
 }
 return "#334155";
}
/** @template {{id?:string,color?:string}} T @param {T[]} entries */
export function withJurisdictionColors(entries){
 const used=new Set(entries.flatMap(d=>typeof d?.color==="string"?[d.color.toLowerCase()]:[]));
 return entries.map(d=>{if(!d||typeof d!=="object")return d;if(d.color!==undefined)return {...d,color:d.color};let attempt=0,color;do{color=automaticJurisdictionColor(d.id,attempt++);}while(used.has(color));used.add(color);return {...d,color};});
}
