import Link from "next/link";
import { PROJECT_STAGES, type ProjectStage } from "@/lib/projects";
import { Glossary } from "./glossary";

export function ProjectStatus({ stage, links = {} }: { stage: ProjectStage; links?: Partial<Record<ProjectStage, string>> }) {
  return <section aria-labelledby="status-title">
    <h2 id="status-title" className="text-xl font-semibold">Project status</h2>
    <p className="mt-2 text-lg font-medium text-sky-700 dark:text-sky-300">{stage}</p>
    <ol aria-label="Project stages" className="mt-4 flex flex-wrap gap-2 text-sm">
      {PROJECT_STAGES.map((label) => <li key={label} aria-current={label === stage ? "step" : undefined} className={"rounded-full border px-3 py-1.5 " + (label === stage ? "border-sky-500 bg-sky-100 text-sky-950 dark:bg-sky-900 dark:text-sky-100" : "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400")}>{links[label] ? <Link href={links[label]!} prefetch={false} className="underline underline-offset-4">{label}</Link> : label}</li>)}
    </ol>
    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">A <Glossary term="P&Z" /> recommendation is separate from a Council decision. The city’s official records control.</p>
  </section>;
}
