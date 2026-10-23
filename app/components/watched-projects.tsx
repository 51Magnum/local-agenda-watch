"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { getServerWatchSnapshot, getWatchSnapshot, parseWatches, resolveWatchedProjects, setWatching, subscribeWatches, type WatchCatalogEntry } from "@/lib/watches";
export default function WatchedProjects({ jurisdiction, catalog }: { jurisdiction: string; catalog: WatchCatalogEntry[] }) {
  const snapshot = useSyncExternalStore(subscribeWatches, getWatchSnapshot, getServerWatchSnapshot);
  const projects = useMemo(() => resolveWatchedProjects(parseWatches(snapshot), jurisdiction, catalog), [snapshot, jurisdiction, catalog]);
  const [error, setError] = useState("");
  return <section aria-labelledby="you-are-watching-title">
    <div className="flex flex-wrap items-baseline justify-between gap-3"><h2 id="you-are-watching-title" className="text-xl font-semibold">You are watching{projects.length > 0 && <span className="ml-2 text-sm font-normal text-zinc-500">({projects.length})</span>}</h2><p className="text-xs text-zinc-500">Saved in this browser</p></div>
    {error && <p role="status" className="mt-3 text-sm">{error}</p>}
    {!projects.length ? <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Check Watch in a map popup to save a project here.</p> : <ul className="mt-5 divide-y border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">{projects.map((project) => <li key={project.href} className="flex items-start justify-between gap-4 py-4">
      <div><a href={project.href} className="font-medium underline underline-offset-4">{project.title}</a><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{[project.status, project.hearing].filter(Boolean).join(" · ") || "Open project for its latest status."}</p><p className="mt-2 font-mono text-xs text-zinc-500">{project.caseIds.join(" · ")}</p></div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked aria-label={"Watch " + project.title} onChange={() => { try { setWatching(project, false); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not update your watch."); } }}/> Watch</label>
    </li>)}</ul>}
  </section>;
}
