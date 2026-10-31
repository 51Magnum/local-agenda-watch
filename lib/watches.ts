import { areaPath, canonicalAreaHref } from "./areas/public-registry";
import type { MapCase } from "./maps/types";
export const WATCH_STORAGE_KEY = "law:watches:v1";
const WATCH_EVENT = "law:watches-changed";
export type WatchedProject = { jurisdiction: string; href: string; title: string; caseIds: string[] };
export type WatchCatalogEntry = { href: string; title: string; caseIds: string[]; status: string; hearing?: string };
export function parseWatches(raw: string): WatchedProject[] {
  try {
    const data = JSON.parse(raw); if (data.version !== 1 || !Array.isArray(data.items)) return [];
    const unique = new Map<string, WatchedProject>();
    for (const value of data.items.slice(0, 500)) {
      if (!value || typeof value.jurisdiction !== "string" || !/^[a-z0-9-]+$/.test(value.jurisdiction) || typeof value.href !== "string" || !(value.href.startsWith("/" + value.jurisdiction + "/")||value.href.startsWith(areaPath(value.jurisdiction)+"/")) || !/^\/[a-z0-9-]+\/[A-Za-z0-9%/_-]+$/.test(value.href) || value.href.includes("//") || typeof value.title !== "string" || !Array.isArray(value.caseIds)) continue;
      const item: WatchedProject = { jurisdiction: value.jurisdiction, href: canonicalAreaHref(value.jurisdiction,value.href), title: value.title.slice(0, 200), caseIds: [...new Set<string>(value.caseIds.filter((id: unknown): id is string => typeof id === "string" && /^[A-Z0-9-]+$/.test(id)))].slice(0, 25) };
      unique.set(item.jurisdiction + "|" + item.href, item);
    }
    return [...unique.values()];
  } catch { return []; }
}
export function getWatchSnapshot(): string { try { return localStorage.getItem(WATCH_STORAGE_KEY) ?? ""; } catch { return ""; } }
export const getServerWatchSnapshot = () => "";
export function subscribeWatches(listener: () => void): () => void {
  const storage = (event: StorageEvent) => { if (event.key === WATCH_STORAGE_KEY || event.key === null) listener(); };
  window.addEventListener(WATCH_EVENT, listener); window.addEventListener("storage", storage);
  return () => { window.removeEventListener(WATCH_EVENT, listener); window.removeEventListener("storage", storage); };
}
export function isWatching(project: Pick<WatchedProject, "jurisdiction" | "href">): boolean { return parseWatches(getWatchSnapshot()).some((p) => p.jurisdiction === project.jurisdiction && p.href === canonicalAreaHref(project.jurisdiction,project.href)); }
export function setWatching(project: WatchedProject, watching: boolean): void {
  const items = parseWatches(getWatchSnapshot()).filter((p) => p.jurisdiction !== project.jurisdiction || p.href !== canonicalAreaHref(project.jurisdiction,project.href));
  if (watching) items.push(project);
  // A blocked/full storage write must report failure, not silently mark a watch saved.
  try { localStorage.setItem(WATCH_STORAGE_KEY, JSON.stringify({ version: 1, items })); }
  catch { throw new Error("Could not save your watch. Browser storage may be unavailable."); }
  window.dispatchEvent(new Event(WATCH_EVENT));
}
export function watchFromCase(jurisdiction: string, item: MapCase, catalog: MapCase[]): WatchedProject {
  return { jurisdiction, href: item.href, title: item.title, caseIds: [...new Set([item.id, ...catalog.filter((c) => c.href === item.href).map((c) => c.id)])] };
}
/** A combined site can represent cases in multiple planning authorities. */
export function watchesFromMapCase(jurisdiction:string,item:MapCase,catalog:MapCase[]):WatchedProject[]{
 if(!item.members)return [watchFromCase(jurisdiction,item,catalog)];
 const projects=new Map<string,WatchedProject>();
 for(const member of item.members){const key=member.areaId+"|"+member.href,old=projects.get(key);if(old)old.caseIds.push(member.caseId);else projects.set(key,{jurisdiction:member.areaId,href:member.href,title:member.title,caseIds:[member.caseId]});}
 return [...projects.values()];
}
export function resolveWatchedProjects(saved: WatchedProject[], jurisdiction: string, catalog: WatchCatalogEntry[]) {
  return saved.filter((p) => p.jurisdiction === jurisdiction).map((project) => {
    const matches = catalog.filter((c) => c.href === project.href || c.caseIds.some((id) => project.caseIds.includes(id)));
    const current = matches[0];
    return { ...project, href:canonicalAreaHref(jurisdiction,current?.href??project.href), title: current?.title ?? project.title, caseIds: [...new Set([...project.caseIds, ...matches.flatMap((c) => c.caseIds)])], status: current?.status, hearing: matches.find((c) => c.hearing)?.hearing };
  });
}
