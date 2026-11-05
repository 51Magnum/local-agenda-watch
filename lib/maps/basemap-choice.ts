export type Basemap = "map" | "satellite";
export const BASEMAP_SESSION_KEY = "law:basemap:v1";
const changed = "law:basemap-changed", memory = new WeakMap<Window,Basemap>();
export function basemapChoice(): Basemap {
  if(typeof window === "undefined")return "map";
  const fallback=memory.get(window);if(fallback)return fallback;
  try{return window.sessionStorage.getItem(BASEMAP_SESSION_KEY)==="satellite"?"satellite":"map";}catch{return "map";}
}
export function chooseBasemap(mode: Basemap) {
  try{window.sessionStorage.setItem(BASEMAP_SESSION_KEY,mode);memory.delete(window);}catch{memory.set(window,mode);}
  window.dispatchEvent(new Event(changed));
}
export function subscribeBasemap(listener:()=>void) {
  if(typeof window === "undefined")return ()=>{};
  window.addEventListener(changed,listener);return ()=>window.removeEventListener(changed,listener);
}
