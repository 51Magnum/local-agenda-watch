import { StageNavigation } from "./project-status";
import { PROJECT_STAGES, type ProjectStage } from "@/lib/projects";
import { latestField, type TimelineData } from "@/lib/timeline/public";
import { evidenceSourceHref, type EvidenceField } from "@/lib/timeline/types";

function dateLabel(value: string): string {
  const date = value.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric" }).format(new Date(date + "T12:00:00-07:00"));
}
function Source({ field }: { field: EvidenceField }) {
  return <a href={evidenceSourceHref(field)} className="text-sm underline underline-offset-4">Source{field.page ? " · p. " + field.page : " · city record"}</a>;
}
export function CaseTimeline({ data, links }: { data: TimelineData; links: Record<ProjectStage, string> }) {
  const { fields } = data;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <section aria-labelledby="timeline-title" className="space-y-5">
    <h2 id="timeline-title" className="text-xl font-semibold">Case timeline</h2>
    <p className="font-medium text-sky-700 dark:text-sky-300">Current status: {data.currentStage}</p>
    <StageNavigation stage={data.currentStage} links={links} />
    <ol aria-label="Case timeline" className="space-y-5 border-l-2 border-zinc-200 pl-5 dark:border-zinc-800">
      {PROJECT_STAGES.map((stage) => {
        const key = stage === "Submitted" ? "appliedDate" : stage === "Under review" ? "reviewDate" : stage === "P&Z hearing" ? "pzHearingDate" : stage === "Council hearing" ? "councilHearingDate" : "decisionDate";
        const date = latestField(fields, key);
        const resultKey = stage === "P&Z hearing" ? "pzResult" : stage === "Council hearing" || stage === "Decided" ? "councilDecision" : undefined;
        const results = resultKey ? fields.filter((field) => field.key === resultKey) : [];
        const body = stage === "P&Z hearing" ? /P&Z|Planning/i : stage === "Council hearing" ? /council/i : undefined;
        const appearances = body ? data.appearances.filter((a) => body.test(a.body)) : [];
        const upcoming = body && data.next && body.test(data.next.body) ? data.next : undefined;
        const hearings = appearances.filter((a) => a.isHearing);
        const fallbackAppearance = [...hearings].reverse().find((a) => a.date <= today) ?? hearings[0] ?? appearances[appearances.length - 1];
        const day = date?.value ?? upcoming?.startsAt.slice(0, 10) ?? fallbackAppearance?.date;
        const recommendation = latestField(fields, "staffRecommendation") ?? fields.find((field) => field.sourceKind === "staff-report");
        return <li key={stage} className="space-y-2">
          <h3 className="font-semibold">{stage}</h3>
          {stage === "Submitted" && (date ? <p>Applied {dateLabel(date.value)}. <Source field={date} /></p> : <p className="text-sm text-zinc-500">Applied date not yet available from the city record.</p>)}
          {stage === "Under review" && <>{date && <p>{dateLabel(date.value)}. <Source field={date} /></p>}{recommendation ? <p className="text-sm">Staff report available. <Source field={recommendation} /></p> : <p className="text-sm text-zinc-500">Review documents appear as sourced evidence becomes available.</p>}</>}
          {body && <>
            {results.length ? [...new Map(results.map((result) => [result.caseId, result])).values()].map((result) => <p key={result.id}>
              {data.caseIds.length > 1 && <span className="font-mono text-xs">{result.caseId}: </span>}
              {stage === "P&Z hearing" ? result.value === "recommend approval" ? "P&Z recommended approval" : result.value === "recommend denial" ? "P&Z recommended denial" : "P&Z continued the hearing" : "Council " + result.value}{(() => { const resultDate = fields.find((field) => field.caseId === result.caseId && field.documentId === result.documentId && field.key === (stage === "P&Z hearing" ? "pzHearingDate" : "decisionDate")); return resultDate ? ", " + dateLabel(resultDate.value) : ""; })()}. <Source field={result} />
            </p>) : day ? <p>{day <= today ? "Met " + dateLabel(day) + ", result pending minutes or decision letter." : "Upcoming: " + dateLabel(day) + "."}</p> : <p className="text-sm text-zinc-500">No hearing scheduled yet.</p>}
            {date && <Source field={date} />}
            {upcoming && <p className="text-sm"><a href={upcoming.agendaUrl ?? upcoming.sourceUrl} className="underline underline-offset-4">Source · upcoming hearing</a></p>}
            {!date && !upcoming && fallbackAppearance && <p className="text-sm"><a href={fallbackAppearance.sourceUrl} className="underline underline-offset-4">Source · {fallbackAppearance.isHearing ? "hearing schedule" : "agenda appearance"}</a></p>}
            {results.map((result) => { const vote = latestField(fields.filter((field) => field.caseId === result.caseId && field.documentId === result.documentId), stage === "P&Z hearing" ? "pzVote" : "councilVote"); return vote ? <p key={vote.id} className="text-sm">{data.caseIds.length > 1 && result.caseId + " · "}Vote: {vote.value}. <Source field={vote} /></p> : null; })}
          </>}
          {stage === "Decided" && (data.finalDecisionApproved ? <><p>Final decision verified from approved city evidence.{date && " " + dateLabel(date.value) + "."}</p>{fields.filter((field) => field.key === "councilDecision").map((field) => <p key={field.id} className="text-sm">{field.caseId}: {field.value}. <Source field={field} /></p>)}{date && <Source field={date} />}</> : <p className="text-sm text-zinc-500">No final decision verified for publication.</p>)}
        </li>;
      })}
    </ol>
    <p className="text-sm leading-6 text-zinc-500">A staff recommendation is separate from a P&amp;Z result or Council decision. Outcomes appear only after their source evidence has been reviewed. The city’s official records control.</p>
  </section>;
}
export function WhatsProposed({ data }: { data: TimelineData }) {
  const keys = ["requestSummary", "acres", "units", "zoningRequested", "staffRecommendation", "keyConditions"] as const;
  const labels = { requestSummary: "Request", acres: "Size (acres)", units: "Homes / lots", zoningRequested: "Requested zoning", staffRecommendation: "Staff recommendation", keyConditions: "Main conditions" };
  const fields = keys.map((key) => latestField(data.fields.filter((field) => field.sourceKind === "staff-report"), key)).filter((field): field is EvidenceField => Boolean(field));
  return <section aria-labelledby="whats-proposed-title" className="space-y-4 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
    <h2 id="whats-proposed-title" className="text-xl font-semibold">What’s proposed</h2>
    {!fields.length ? <p className="text-sm text-zinc-500">Staff-report details will appear when sourced evidence is available. See the official documents below.</p> : <dl className="space-y-4">{fields.map((field) => <div key={field.id}><dt className="text-sm font-medium">{labels[field.key as typeof keys[number]]}</dt><dd className="mt-1 space-y-1"><p className="whitespace-pre-wrap text-sm leading-7">{field.value}</p><Source field={field} /></dd></div>)}</dl>}
    <p className="text-xs text-zinc-500">This describes the request and staff’s advice. It does not establish project approval.</p>
  </section>;
}
