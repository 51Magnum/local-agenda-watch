export type ProjectMatch = {
  aiTitle?:boolean;
  areaId: string;
  caseId: string;
  title: string;
  areaName: string;
  typeLabel: string;
  caseIds?: string[];
};

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

/** Every word may match part of a name, type, jurisdiction or case number. */
export function findProjects(projects: ProjectMatch[], query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return projects.filter((p) => {
    const text = normalize([p.title, p.caseId, ...(p.caseIds ?? []), p.areaName, p.typeLabel].join(" "));
    return words.every((word) => text.includes(word));
  }).sort((a, b) => a.title.localeCompare(b.title) || a.areaName.localeCompare(b.areaName)).slice(0, 20);
}
