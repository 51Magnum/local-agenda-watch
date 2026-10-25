"use client";
/* eslint-disable @next/next/no-img-element -- approved private-source images use our existing cached visual endpoint. */
import {hearingDateTime} from "@/lib/areas/format";
import { useEffect, useRef, useState } from "react";
import type { PaneData } from "@/lib/maps/project-questions";
import type { MapVisual } from "@/lib/maps/types";
import { RESIDENT_QUESTIONS } from "@/lib/maps/project-questions";
import { isWatching, setWatching, watchesFromMapCase } from "@/lib/watches";
export default function ProjectPane({
  data,
  onClose,
  onImage,
  savedPlace,
  onWatch,
  page = false,
}: {
  page?: boolean;
  data: PaneData;
  onClose: () => void;
  onImage: (v: MapVisual) => void;
  savedPlace?: { distance: number };
  onWatch: () => void;
}) {
  const targets = data.item.members?.length
    ? watchesFromMapCase(data.area.id, data.item, [data.item])
    : [
        {
          jurisdiction: data.area.id,
          href: data.item.href,
          title: data.item.popup?.projectName ?? data.item.title,
          caseIds: data.caseIds,
        },
      ];
  const ref = useRef<HTMLElement>(null),
    start = useRef<number | null>(null);
  const [size, setSize] = useState<"peek" | "half" | "full">("half"),
    [watch, setWatch] = useState(() => targets.every(isWatching)),
    [copied, setCopied] = useState(false),
    [error, setError] = useState("");
  const item = data.item;
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [item.id, item.href, data.area.id]);
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
    (data.area.timezone === "America/Denver"
      ? " Mountain Time"
      : " " + data.area.timezone);
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      className={"law-resident-pane " + (page?"law-project-page ":"") + size}
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
          aria-label={"Expand project details, currently " + size}
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
            {page && item.popup?.aiGenerated && <p className="text-xs text-zinc-500">AI-generated summary; check the linked official records.</p>}
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
              <>
                <strong>{hearingDateTime(data.next.startsAt,data.area.timezone)}</strong>
                <p>{data.next.body}</p>
                <p>{data.next.location}</p>
                <small>{data.next.role}</small>
              </>
            ) : (
              <p>
                {item.stage === "Decided"
                  ? (item.popup?.progress.find((p) => p.state === "current")
                      ?.label ??
                    "Decision recorded; outcome not specified in the available record")
                  : item.stage === "Recorded"
                    ? "Recorded in official records."
                    : "No hearing is confirmed in the available records."}
              </p>
            )}
          </section>
          <section className="law-pane-section">
            <h2 className="law-question-heading">{RESIDENT_QUESTIONS[4]}</h2>
            {!data.impacts.length && !data.conditions.length && (
              <p>No verified impact details are available yet.</p>
            )}
            {data.impacts.map((f) => (
              <div key={f.label}>
                <h3>{f.label}</h3>
                <p>
                  {f.value}{" "}
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noreferrer">
                      Source
                    </a>
                  )}
                </p>
              </div>
            ))}
            {data.conditions.length > 0 && (
              <>
                <h3>Conditions</h3>{data.conditionsSource&&<a href={data.conditionsSource} target="_blank" rel="noreferrer">Source conditions</a>}
                <ul>
                  {data.conditions.slice(0, 5).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
                {data.conditions.length > 5 && (
                  <details>
                    <summary>Show all conditions</summary>
                    <ul>
                      {data.conditions.slice(5).map((c, i) => (
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
            {!data.participationClosed && !data.expiredDeadlineMessage && data.next?.commentDeadline && (
              <p>
                Comment deadline: {date(data.next.commentDeadline)}
                {data.next.commentDeadline.length > 10
                  ? " · " + time(data.next.commentDeadline)
                  : ""}
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
              <button onClick={onWatch}>Watch this place</button>
            </div>
            <small>
              Dates can change. Confirm with the official notice. Alerts are
              coming soon.
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
              <label>
                <input
                  type="checkbox"
                  checked={watch}
                  onChange={(e) => {
                    try {
                      for (const target of targets)
                        setWatching(target, e.target.checked);
                      setWatch(e.target.checked);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                />{" "}
                Watch project
              </label>
            </div>
            <p>
              Updated automatically from official records · last checked{" "}
              {date(data.updatedAt)}
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
    </aside>
  );
}
