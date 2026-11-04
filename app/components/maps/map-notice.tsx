"use client";
import {useCallback, useEffect, useRef, useState, type ReactNode} from "react";
import {noticeTimer} from "@/lib/maps/notice-timer";
import "./map-notice.css";

export type NoticeKind = "info" | "error";
export function useMapNotice() {
  const [notice, setNotice] = useState<{message: string; kind: NoticeKind; id: number} | null>(null);
  const sequence = useRef(0);
  const showNotice = useCallback((message: string, kind: NoticeKind = "info") => {
    setNotice(message ? {message, kind, id: ++sequence.current} : null);
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);
  return {notice, showNotice, dismissNotice};
}

export default function MapNotice({message, kind = "info", onDismiss, children, className = ""}: {message: string; kind?: NoticeKind; onDismiss: () => void; children?: ReactNode; className?: string}) {
  const dismiss = useRef(onDismiss), timer = useRef<ReturnType<typeof noticeTimer> | null>(null);
  const paused = useRef(new Set<string>());
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (kind === "error") return;
    const active = noticeTimer(() => dismiss.current());
    timer.current = active;
    paused.current.forEach(reason => active.pause(reason));
    return () => { active.cancel(); timer.current = null; };
  }, [message, kind]);
  function pause(reason: string) { paused.current.add(reason); timer.current?.pause(reason); }
  function resume(reason: string) { paused.current.delete(reason); timer.current?.resume(reason); }
  return <div className={"law-map-notice " + className} data-kind={kind}
    onMouseEnter={() => pause("hover")} onMouseLeave={() => resume("hover")}
    onFocusCapture={() => pause("focus")} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) resume("focus"); }}>
    <div role={kind === "error" ? "alert" : "status"} aria-atomic="true">{message}{children}</div>
    <button type="button" className="law-map-notice-close" aria-label="Dismiss message" onClick={onDismiss}>×</button>
  </div>;
}
