import Link from "next/link";
import { PROJECT_STAGES, type ProjectStage } from "@/lib/projects";
import { Glossary } from "./glossary";

export function ProjectStatus({ stage, links = {}, viewing, statusLabel }: {
  statusLabel?: string;
  stage?: ProjectStage;
  links?: Partial<Record<ProjectStage, string>>;
  viewing?: ProjectStage;
}) {
  return <section aria-labelledby="status-title">
    <h2 id="status-title" className="text-xl font-semibold">Project status</h2>
    <p className="mt-2 text-lg font-medium text-sky-700 dark:text-sky-300">{statusLabel ? (stage ? "Current status: " : "") + statusLabel : (stage ? "Current status: " + stage : "Current status unavailable")}</p>
    <StageNavigation stage={stage} viewing={viewing} links={links} />
    {viewing && <p className="mt-3 text-sm font-medium">Viewing: {viewing} records</p>}
    <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Choose a stage to view its documents or meeting records. A <Glossary term="P&Z" /> recommendation is separate from a Council decision. The city’s official records control.</p>
  </section>;
}


export function StageNavigation({ stage, links, viewing }: {
  stage?: ProjectStage;
  links: Partial<Record<ProjectStage, string>>;
  viewing?: ProjectStage;
}) {
  const selected = viewing ?? stage;
  return (
    <nav aria-label="Case stages and meeting records" className="mt-4">
      <ol aria-label="Project stages" className="flex flex-wrap gap-2 text-sm">
        {PROJECT_STAGES.map((label) => <li key={label} aria-current={label === stage ? "step" : undefined}>
          {links[label] ? <Link href={links[label]!} prefetch={false} aria-current={label === viewing ? "page" : undefined} className={"inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 underline underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 " + (label === selected ? "border-sky-500 bg-sky-100 text-sky-950 dark:bg-sky-900 dark:text-sky-100" : "border-zinc-300 text-zinc-600 hover:border-sky-500 hover:bg-sky-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-sky-950")}>{label}</Link> : <span className="inline-flex min-h-11 items-center rounded-full border border-zinc-200 px-3 py-1.5 text-zinc-500 dark:border-zinc-800">{label}</span>}
        </li>)}
      </ol>
    </nav>
  );
}
