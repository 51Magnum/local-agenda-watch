import { residentHref } from "@/lib/areas/record-links";
import { popupApplicationCopy } from "@/lib/maps/popup-model";
import { evidenceSourceHref, type EvidenceField } from "@/lib/timeline/types";
export default function MapSummaryEvidence({fields}:{fields:EvidenceField[]}) {
  const copy = popupApplicationCopy(fields);
  if (!copy.explanation || !copy.source) return null;
  const source = residentHref(evidenceSourceHref(copy.source));
  return <aside className="space-y-1"><p className="text-sm">{copy.explanation}</p><p className="text-xs text-zinc-500">AI-generated summary from the application. {source ? <a href={source} className="underline">Source</a> : "Source: official application record."}</p></aside>;
}
