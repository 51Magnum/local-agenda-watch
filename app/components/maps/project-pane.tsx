"use client";
/* eslint-disable @next/next/no-img-element -- approved private-source images use our existing cached visual endpoint. */
import {hearingDateTime} from "@/lib/areas/format";
import { useEffect, useId, useRef, useState } from "react";
import type { PaneData } from "@/lib/maps/project-questions";
import type { MapVisual } from "@/lib/maps/types";
import { RESIDENT_QUESTIONS } from "@/lib/maps/project-questions";
import AlertForm from "../alert-form";
import HearingNext from "./hearing-next";
export default function ProjectPane({
  data,
  onClose,
  onImage,
  savedPlace,
  onWatch,
  page = false,
  preview = false,
}: {
  preview?: boolean;
  page?: boolean;
  data: PaneData;
  onClose: () => void;
  onImage: (v: MapVisual) => void;
  savedPlace?: { distance: number };
  onWatch: () => void;
}) {
  const ref = useRef<HTMLElement>(null),
    start = useRef<number | null>(null);
  const [size, setSize] = useState<"peek" | "half" | "full">("half"),
    [watchStep, setWatchStep] = useState<"closed" | "choose" | "project">(()=>typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("watchProject")==="1" ? "project" : "closed"),
    [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  const item = data.item;
  const Container = page ? "article" : "aside";
  const watchOptionsId = useId();
  useEffect(() => {
    if (!page) ref.current?.focus({ preventScroll: true });
  }, [item.id, item.href, data.area.id, page]);
  const date = (v: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: v.length === 10 ? "UTC" : data.area.timezone,
    }).format(new Date(v.length === 10 ? v + "T12:00:00Z" : v));
  const time = (v: string) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: data.area.timezone,
    }).format(new Date(v)) +
    (new Intl.DateTimeFormat("en-US",{timeZone:data.area.timezone,timeZoneName:"long"}).formatToParts(new Date(v)).some(p=>p.type==="timeZoneName"&&/^Mountain /.test(p.value))
      ? " Mountain Time"
      : " " + data.area.timezone);
  const impactRows = data.impacts.map((f, index) => (
    <div key={f.label + ":" + index}>
      <h3>{f.label}</h3>
      <p>
        {f.value}{" "}
        {f.url && (
          <a href={f.url} target="_blank" rel="noreferrer" title={f.sourceTitle} aria-label={"Official source for " + f.label + (f.sourcePage ? ", page " + f.sourcePage : "")}>
            {f.sourcePage ? "Source · p. " + f.sourcePage : "Source"}
          </a>
        )}
      </p>
    </div>
  ));
  const visibleImpacts = page ? impactRows.length : 2;
  const visibleConditions = page ? 5 : 2;
  return (
    <Container
      ref={ref}
      tabIndex={-1}
      className={"law-resident-pane " + (page ? "law-project-page" : size)}
      aria-label="Project details"
      data-size={size}
    >
      <div
        className="law-sheet-handle"
        onTouchStart={(e) => {
          start.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (start.current == null) return;
          const delta = e.changedTouches[0].clientY - start.current;
          if (Math.abs(delta) > 25)
            setSize(delta < 0 ? "full" : size === "full" ? "half" : "peek");
          start.current = null;
        }}
      >
        <button
          aria-label={size === "full" ? "Collapse project details" : "Expand project details, currently " + size}
          onClick={() =>
            setSize(
              size === "peek" ? "half" : size === "half" ? "full" : "peek",
            )
          }
        >
          <span />
        </button>
      </div>
      <button
        className="law-pane-close"
        onClick={onClose}
        aria-label="Close project details"
      >
        ×
      </button>
      <div className="law-pane-content">
        <h1>{item.popup?.projectName ?? item.title}</h1>
        {item.aiTitle&&<p className="text-xs text-zinc-500">AI-generated title; check the linked official source.</p>}
        <section aria-labelledby="question-what">
          <h2 className="law-question-heading" id="question-what">
            {RESIDENT_QUESTIONS[0]}
          </h2>
          {item.popup?.headline && item.popup.headline !== item.popup.projectName && <p className="law-proposal-headline">{item.popup.headline}</p>}
          <p className="law-pane-status">
            {item.popup?.progress.find((p) => p.state === "current")?.label ??
              item.stage}
          </p>
          <p className="law-pane-jurisdiction">
            {item.popup?.projectName &&
            item.popup.projectName !== (item.popup?.headline ?? item.title)
              ? item.popup.projectName + " · "
              : ""}
            {data.area.name}
          </p>
          <div className="law-pane-expanded">
            {item.popup?.explanation && <p>{item.popup.explanation}</p>}
            {data.summarySource && <a href={data.summarySource} target="_blank" rel="noreferrer">Summary source</a>}
            {data.aiSummaryPending && <p className="text-xs text-zinc-500">AI summary pending. Official application facts are shown below.</p>}
            {(page || preview) && item.popup?.aiGenerated && <p className="text-xs text-zinc-500">AI-generated summary; check the linked official records.</p>}
            {item.visual && (
              <figure>
                <button
                  className="law-pane-image"
                  onClick={() => onImage(item.visual!)}
                  aria-label="Enlarge project image"
                >
                  <img
                    src={
                      item.visual.src +
                      (item.visual.src.includes("?") ? "&" : "?") +
                      "preview=main-v1"
                    }
                    alt={item.visual.alt}
                  />
                </button>
                <figcaption>{item.visual.label}</figcaption>
              </figure>
            )}
          </div>
        </section>
        <div className="law-pane-expanded">
          <section>
            <h2 className="law-question-heading">{RESIDENT_QUESTIONS[1]}</h2>
            <p>
              {data.where ||
                "Location is not confirmed in the available records."}
            </p>
            {savedPlace && (
              <p>{savedPlace.distance.toFixed(1)} mi from your place</p>
            )}
          </section>
          <section className="law-pane-section">
            <h2 className="law-question-heading">{RESIDENT_QUESTIONS[2]}</h2>
            {!data.history.length && (
              <p>No completed steps are confirmed in the available records.</p>
            )}
            <ol className="law-pane-timeline">
              {data.history.map((row, i) => (
                <li key={i}>
                  {row.label}
                  {row.source && (
                    <a href={row.source} target="_blank" rel="noreferrer">
                      {" "}
                      Source
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </section>
          <section className="law-pane-next">
            <h2 className="law-question-heading">{RESIDENT_QUESTIONS[3]}</h2>
            {data.next ? (
              <HearingNext next={data.next} timezone={data.area.timezone}/>
            ) : (
              <p>
                {data.noHearing?.message ?? (item.stage === "Decided"
                  ? (item.popup?.progress.find((p) => p.state === "current")
                      ?.label ??
                    "Decision recorded; outcome not specified in the available record")
                  : item.stage === "Recorded"
                    ? "Recorded in official records."
                    : "No hearing is confirmed in the available records.")}
              </p>
            )}
            {!data.next && data.noHearing?.sources.map(s=><a key={s.url} className="mr-3 underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a>)}
          </section>
          <section className="law-pane-section">
            <h2 className="law-question-heading">{RESIDENT_QUESTIONS[4]}</h2>
            {!data.impacts.length && !data.conditions.length && (
              <p>No verified impact details are available in the records reviewed.</p>
            )}
            {impactRows.slice(0, visibleImpacts)}
            {impactRows.length > visibleImpacts && (
              <details key={data.area.id + ":" + item.id + ":impacts"}>
                <summary>More documented details ({impactRows.length - visibleImpacts})</summary>
                {impactRows.slice(visibleImpacts)}
              </details>
            )}
            {data.conditions.length > 0 && (
              <>
                <h3>Conditions</h3>{data.conditionsSource&&<a href={data.conditionsSource} target="_blank" rel="noreferrer">Source conditions</a>}
                <ul>
                  {data.conditions.slice(0, visibleConditions).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
                {data.conditions.length > visibleConditions && (
                  <details>
                    <summary>More conditions ({data.conditions.length - visibleConditions})</summary>
                    <ul>
                      {data.conditions.slice(visibleConditions).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </section>
          <section>
            <h2 className="law-question-heading">{RESIDENT_QUESTIONS[5]}</h2>
            {!data.participationClosed && !data.expiredDeadlineMessage && data.next?.commentDeadline && data.next.commentSourceUrl && (
              <p>
                Comment deadline: {date(data.next.commentDeadline)}
                {data.next.commentDeadline.length > 10
                  ? " · " + time(data.next.commentDeadline)
                  : ""}
                {" "}<a href={data.next.commentSourceUrl} target="_blank" rel="noreferrer">Deadline source</a>
              </p>
            )}
            {data.participationClosed && <p>This case is closed. See the official record for the outcome and any published appeal information.</p>}
            {data.expiredDeadlineMessage && <p>{data.expiredDeadlineMessage}</p>}
            {!data.participationClosed && data.commentInstructions && <p>{data.commentInstructions}</p>}
            <div className="law-pane-actions">
              {!data.participationClosed && data.commentUrl && (
                <a href={data.commentUrl} target="_blank" rel="noreferrer">
                  {data.commentLinkLabel ?? "How to comment"} ↗
                </a>
              )}
              {!data.participationClosed && data.calendarHref && (
                <a href={data.calendarHref}>Add to calendar</a>
              )}
              {!preview && <button
                type="button"
                className="law-email-updates-button"
                aria-expanded={watchStep !== "closed"}
                aria-controls={watchOptionsId}
                onClick={() => setWatchStep(step => step === "closed" ? "choose" : "closed")}
              >
                Get email updates
              </button>}
            </div>
            {watchStep !== "closed" && (
              <section id={watchOptionsId} aria-label="Email update options" className="mt-4 space-y-4 rounded-xl border border-teal-700/30 p-4">
                <h3 className="font-semibold">What would you like to follow?</h3>
                <div className="grid gap-3">
                  <button
                    type="button"
                    aria-pressed={watchStep === "project"}
                    onClick={() => setWatchStep("project")}
                    className={"cursor-pointer rounded-xl border border-teal-700 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 " + (watchStep === "project" ? "bg-teal-700 text-white hover:bg-teal-800" : "bg-white text-slate-900 hover:bg-teal-50")}
                  >
                    <span className="block font-semibold">Only this project</span>
                    <span className="mt-1 block text-sm">Updates about this development and its related cases.</span>
                  </button>
                  <button
                    type="button"
                    onClick={onWatch}
                    className="cursor-pointer rounded-xl border border-teal-700 bg-white p-4 text-left text-slate-900 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <span className="block font-semibold">Projects near a place</span>
                    <span className="mt-1 block text-sm">Updates about all tracked projects within a radius, including new projects. Review the place and radius before signing up.</span>
                  </button>
                </div>
                {watchStep === "project" && <AlertForm key={data.area.id + ":" + item.id} target={{kind:"project",areaId:data.area.id,caseId:item.id.split(":").at(-1)!}}/>}
              </section>
            )}
            <small>
              Dates can change. Confirm with the official notice. Email updates
              start only after you confirm your email.
            </small>
          </section>
          <footer>
            {!!data.officialRecords?.length && (
              <section aria-label="Official project records">
                <h2>Official project records</h2>
                <ul>
                  {data.officialRecords.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="law-pane-actions">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setError("Copy the URL from your address bar.");
                  }
                }}
              >
                {copied ? "Link copied" : "Share"}
              </button>
            </div>
            <p>
              {data.lastCheckedAt ? "Last checked " + hearingDateTime(data.lastCheckedAt,data.area.timezone) : "A successful source sweep has not completed yet."}
            </p>
            <a
              href={
                "/contact?project=" +
                encodeURIComponent(data.area.id + "/" + data.caseIds[0])
              }
            >
              Report an error
            </a>
            {!!data.documents?.length && <section><h2>Source documents</h2><ul>{data.documents.map(d=><li key={d.url}><a href={d.url} target="_blank" rel="noreferrer">{d.label}</a></li>)}</ul></section>}
            {!!data.parcels?.length && <details><summary>Parcel details</summary><p>{data.parcels.join(", ")}</p></details>}
            {!!data.relatedCases?.filter(c => c.areaId !== data.area.id || c.caseId !== item.id).length && <section aria-label="Also on this site">
              <h2>Also on this site</h2>
              <ul>{data.relatedCases.filter(c => c.areaId !== data.area.id || c.caseId !== item.id).map(c => <li key={c.areaId+"/"+c.caseId}>
                <span>{c.caseId} · {c.title ?? c.label}</span>
                {" · "}{c.status ?? c.stage}{c.date ? " · "+date(c.date) : ""}
              </li>)}</ul>
            </section>}
            <p className="law-case-references">
              Case numbers:{" "}
              {data.relatedCases?.length
                ? data.relatedCases
                    .map((c) => c.label + " · " + c.caseId)
                    .join("; ")
                : data.caseIds.join(" · ")}
            </p>
            {error && <p role="status">{error}</p>}
          </footer>
        </div>
      </div>
    </Container>
  );
}
