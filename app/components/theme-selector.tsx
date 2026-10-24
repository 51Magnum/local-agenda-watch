"use client";
import {useSyncExternalStore} from "react";
import {THEME_STORAGE_KEY,themePreference,type ThemePreference} from "@/lib/theme";
const changed="law:theme-changed";
const snapshot=()=>themePreference(document.documentElement.dataset.themePreference);
const serverSnapshot=():ThemePreference=>"system";
function apply(preference:ThemePreference){
 const root=document.documentElement;
 root.dataset.themePreference=preference;
 root.dataset.theme=preference==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):preference;
 root.style.colorScheme=root.dataset.theme;
}
function subscribe(listener:()=>void){
 const media=window.matchMedia("(prefers-color-scheme: dark)");
 const systemChanged=()=>apply(snapshot());
 const storageChanged=(event:StorageEvent)=>{if(event.key===THEME_STORAGE_KEY||event.key===null){apply(themePreference(event.newValue));listener();}};
 media.addEventListener("change",systemChanged);
 window.addEventListener("storage",storageChanged);
 window.addEventListener(changed,listener);
 apply(snapshot());
 return ()=>{media.removeEventListener("change",systemChanged);window.removeEventListener("storage",storageChanged);window.removeEventListener(changed,listener);};
}
export default function ThemeSelector(){
 const preference=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
 return <label className="flex shrink-0 items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400"><span className="hidden sm:inline">Appearance</span><select aria-label="Appearance" value={preference} onChange={event=>{
  const next=themePreference(event.target.value);apply(next);
  try{localStorage.setItem(THEME_STORAGE_KEY,next);}catch{/* The choice still works for this page when storage is blocked. */}
  window.dispatchEvent(new Event(changed));
 }} className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label>;
}
