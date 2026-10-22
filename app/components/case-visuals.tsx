import Image from "next/image";
import type { CaseVisual } from "@/lib/case-evidence";

export function CaseVisuals({ visuals, reportUrl }: { visuals?: CaseVisual[]; reportUrl?: string }) {
  if (!visuals?.length || !reportUrl) return null;
  return <section aria-labelledby="case-visuals-title" className="flex flex-col gap-5">
    <div>
      <h2 id="case-visuals-title" className="text-xl font-semibold">Maps from the staff report</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Official exhibits published with the September 29, 2026 P&amp;Z staff report. Base-map dates may be earlier. Select a map to view it full size.</p>
    </div>
    <div className="grid gap-6 sm:grid-cols-2">
      {visuals.map((visual) => <figure key={visual.src} className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <a href={visual.src} target="_blank" rel="noopener noreferrer" aria-label={"View full-size " + visual.title.toLowerCase()} className="block bg-white">
          <Image src={visual.src} alt={visual.alt} width={visual.width} height={visual.height} sizes="(min-width: 640px) 416px, 100vw" className="h-auto w-full" />
        </a>
        <figcaption className="space-y-2 p-4 text-sm leading-6">
          <h3 className="font-semibold">{visual.title}</h3>
          <p className="text-zinc-600 dark:text-zinc-400">{visual.caption}</p>
          <a href={reportUrl + "#page=" + visual.sourcePage} target="_blank" rel="noopener noreferrer" className="inline-block underline underline-offset-4">Official staff report · PDF page {visual.sourcePage}</a>
        </figcaption>
      </figure>)}
    </div>
  </section>;
}
