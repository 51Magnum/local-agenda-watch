"use client";
import { useState } from "react";
import type { ProjectMatch } from "@/lib/maps/project-search";

export default function ProjectFinder({ onSelect }: { onSelect: (project: ProjectMatch) => void }) {
  const [query, setQuery] = useState(""), [projects, setProjects] = useState<ProjectMatch[]>([]),
    [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <div className="law-project-finder">
    <form onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setMessage(""); setProjects([]);
      try {
        const response = await fetch("/api/map/find?" + new URLSearchParams({ q: query.trim() }));
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        setProjects(data.projects);
        setMessage(data.projects.length ? `${data.projects.length === 20 ? "First 20" : data.projects.length} matches` : "No matches. Try fewer words or a city or county name.");
      } catch { setMessage("Project search is unavailable. Please try again."); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="project-finder">Find a project</label>
      <small id="project-search-help">Part of a name, case number, city/county or project type.</small>
      <div><input id="project-finder" aria-describedby="project-search-help" placeholder="e.g. Braeburn or Nampa plat" minLength={2} maxLength={100} required value={query} onChange={(e) => setQuery(e.target.value)} />
      <button disabled={busy}>{busy ? "Searching…" : "Find"}</button></div>
    </form>
    <p role="status">{message}</p>
    {projects.length > 0 && <ul>{projects.map((project) => <li key={project.areaId + "/" + project.caseId}>
      <button onClick={() => onSelect(project)}>{project.title}<small>{project.areaName} · {project.caseId}</small></button>
    </li>)}</ul>}
  </div>;
}
