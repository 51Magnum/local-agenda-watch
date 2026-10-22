import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getLocality } from "@/lib/localities";
import { getLocalityContext, localityHref } from "@/lib/locality";
import { braeburnCreek, getProjectNextHearing, getProjectStage, PROJECT_STAGES, PUBLIC_COMMENT_URL } from "@/lib/projects";
import { getProjectDocuments } from "@/lib/project-documents";
import { ProjectNextStep } from "@/app/components/project-next-step";
import { Glossary } from "@/app/components/glossary";
import ShareProject from "@/app/components/share-project";

const project = braeburnCreek;
const canonical = "https://www.localagendawatch.com/nampa/" + project.slug;
export const metadata: Metadata = {
  title: project.title,
  description: project.summary,
  alternates: { canonical },
  openGraph: {
    type: "website", title: project.title, description: project.summary, url: canonical,
    images: [{ url: "https://www.localagendawatch.com" + project.image, width: 1535, height: 1054, alt: "Braeburn Creek site at Amity and Happy Valley, outlined on an aerial map" }],
  },
  twitter: { card: "summary_large_image", title: project.title, description: project.summary, images: ["https://www.localagendawatch.com" + project.image] },
};

export default async function BraeburnCreekPage() {
  const ctx = await getLocalityContext();
  const locality = getLocality("nampa")!;
  const feed = await locality.getHearings?.().catch((err: unknown) => {
    console.error("[project] Application feed unavailable", err);
    return undefined;
  });
  const next = getProjectNextHearing(project, feed);
  const stage = getProjectStage(project, feed);
  const documents = await getProjectDocuments(project, locality, feed);
  return <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-10 sm:py-14">
    <nav className="text-sm text-zinc-500 dark:text-zinc-400"><Link href={localityHref("nampa", "", ctx)} className="underline underline-offset-4">Nampa</Link><span className="mx-2">/</span>Braeburn Creek</nav>
    <header className="flex flex-col items-start gap-4">
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Nampa project watch</p>
      <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{project.title}</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-300">{project.location}</p>
      <p className="max-w-3xl text-base leading-8 text-zinc-600 dark:text-zinc-300">{project.summary}</p>
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200">Developer proposal, not yet approved.</p>
      <ShareProject />
    </header>

    <section aria-labelledby="status-title">
      <h2 id="status-title" className="text-xl font-semibold">Project status</h2>
      <p className="mt-2 text-lg font-medium text-sky-700 dark:text-sky-300">{stage}</p>
      <ol aria-label="Project stages" className="mt-4 flex flex-wrap gap-2 text-sm">
        {PROJECT_STAGES.map((label) => <li key={label} aria-current={label === stage ? "step" : undefined} className={"rounded-full border px-3 py-1.5 " + (label === stage ? "border-sky-500 bg-sky-100 text-sky-950 dark:bg-sky-900 dark:text-sky-100" : "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400")}>{label}</li>)}
      </ol>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">A <Glossary term="P&Z" /> recommendation is separate from a Council decision. The city’s official records control.</p>
    </section>

    <ProjectNextStep hearing={next} calendarHref={localityHref("nampa", "/braeburn-creek/hearing.ics", ctx)} />

    <section aria-labelledby="location-title" className="flex flex-col gap-4">
      <h2 id="location-title" className="text-xl font-semibold">Where this is</h2>
      <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">Parcels R3066500000 and R3066301000. The March developer notice describes 137 acres; the city’s application feed lists approximately 138 acres.</p>
      <figure>
        <Image src={project.image} alt="Aerial map showing the Braeburn Creek site outlined northeast of Amity Avenue and Happy Valley Road" width={1535} height={1054} sizes="(min-width: 1024px) 976px, 100vw" className="h-auto w-full rounded-xl border border-zinc-200 dark:border-zinc-800" />
        <figcaption className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Source aerial map retained from the original neighborhood notice; it is not a current survey. <a href="/nampa/toll-brothers-site-map.png" className="underline underline-offset-2">Open original PNG</a></figcaption>
      </figure>
      <a href="https://www.google.com/maps?q=E+Amity+Ave+and+S+Happy+Valley+Rd,+Nampa,+ID" className="text-sm underline underline-offset-4">View intersection on Google Maps</a>
    </section>

    <section aria-labelledby="cases-title" className="flex flex-col gap-5">
      <h2 id="cases-title" className="text-xl font-semibold">Related cases &amp; documents</h2>
      <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400"><Glossary term="annexation">Annexation</Glossary> brings the property into city limits; a <Glossary term="rezone" /> establishes permitted land uses. A <Glossary term="preliminary plat" /> sets out proposed lots and streets. These are related requests for one project.</p>
      <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">Reports and agendas are dated by hearing; the September P&amp;Z documents are historical. <a href="https://nampa.primegov.com/public/portal" className="underline underline-offset-4">Check the official portal for the latest Council agenda.</a></p>
      {documents.map((item) => <article key={item.id} id={item.id} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="font-semibold">{item.label}</h3>
        <p className="mt-1 font-mono text-sm text-zinc-500 dark:text-zinc-400">{item.id}</p>
        <ul className="mt-4 space-y-4 text-sm">
          <li><a href="/nampa/toll-brothers-concept-plan.png" className="underline underline-offset-4">Developer concept / site plan — original PNG</a><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Shared project exhibit from the March 13, 2026 developer notice; consult the official case file for revisions.</p></li>
          {item.documents.map((doc) => <li key={doc.label + doc.url}><a href={doc.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{doc.label}</a><p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">Official source: <a href={doc.sourceUrl} className="underline">{doc.sourceUrl}</a></p></li>)}
          {!item.documents.some((d) => /staff[\s_-]*report/i.test(d.label)) && <li><a href={item.portalUrl + "?tab=attachments"} className="underline underline-offset-4">Find staff reports in the official case file</a><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.retrievalFailed ? "The city’s document list is temporarily unavailable here." : "No direct staff-report link has been retrieved."}</p></li>}
          {!item.documents.some((d) => /agenda/i.test(d.label)) && <li><a href="https://nampa.primegov.com/public/portal" className="underline underline-offset-4">Check the official portal for the Council agenda</a><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">No agenda link retrieved for this case yet.</p></li>}
        </ul>
        <p className="mt-5 break-all border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">Official case source: <a href={item.portalUrl} className="underline">{item.portalUrl}</a></p>
        <Link href={localityHref("nampa", "/plan/" + item.id, ctx)} className="mt-3 inline-block text-sm underline underline-offset-4">View individual case record</Link>
      </article>)}
    </section>

    <section aria-labelledby="plan-title" className="flex flex-col gap-4">
      <h2 id="plan-title" className="text-xl font-semibold">Developer concept plan</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">March 13, 2026 concept, supplied with the neighborhood meeting notice. Layout and unit counts may change during review.</p>
      <Image src="/nampa/toll-brothers-concept-plan.webp" width={1800} height={2332} alt="Developer's March concept plan for Braeburn Creek, showing proposed homes, streets and shared spaces" sizes="(min-width: 1024px) 976px, 100vw" className="h-auto w-full rounded-xl border border-zinc-200 dark:border-zinc-800" />
      <a href="/nampa/toll-brothers-concept-plan.png" className="text-sm underline underline-offset-4">Open original full-resolution PNG</a>
      <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><summary className="cursor-pointer text-sm font-medium">Future land use map reference</summary>
        <Image src="/nampa/toll-brothers-site-map-FLUM.webp" width={782} height={610} alt="Source site map overlaid on Nampa’s Future Land Use Map" className="mt-4 h-auto w-full" />
        <a href="/nampa/toll-brothers-site-map-FLUM.png" className="mt-3 inline-block text-sm underline">Open original PNG</a>
      </details>
    </section>
    <footer className="border-t border-zinc-200 pt-6 text-sm leading-7 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <p>Sources: developer neighborhood notice dated March 13, 2026; City of Nampa case records and public hearing schedule; <a href={PUBLIC_COMMENT_URL} className="underline">official participation instructions</a>.</p>
      <p>Independent project information. Local Agenda Watch is not affiliated with the developer or the City of Nampa.</p>
    </footer>
  </main>;
}
