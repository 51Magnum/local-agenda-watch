export type ThemePreference="light"|"dark"|"system";
export const THEME_STORAGE_KEY="law:theme";
export function themePreference(value:unknown):ThemePreference{return value==="light"||value==="dark"?value:"system";}
/** Runs in the head before paint so a saved choice never flashes the other theme. */
export const THEME_BOOTSTRAP=`(()=>{let p="system";try{const v=localStorage.getItem("${THEME_STORAGE_KEY}");if(v==="light"||v==="dark")p=v;}catch{}const d=document.documentElement;d.dataset.themePreference=p;d.dataset.theme=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;d.style.colorScheme=d.dataset.theme;})();`;
