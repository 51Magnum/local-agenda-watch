export const MAP_NOTICE_DURATION = 4000;

/** Pause reasons overlap: leaving hover must not resume a focused notice. */
export function noticeTimer(dismiss: () => void, duration = MAP_NOTICE_DURATION) {
  let remaining = duration, started = Date.now(), timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const paused = new Set<string>();
  const start = () => { started = Date.now(); timer = setTimeout(() => { cancelled = true; dismiss(); }, remaining); };
  start();
  return {
    pause(reason: string) {
      if (cancelled || paused.has(reason)) return;
      if (!paused.size) { clearTimeout(timer); remaining = Math.max(0, remaining - (Date.now() - started)); }
      paused.add(reason);
    },
    resume(reason: string) {
      if (cancelled || !paused.delete(reason) || paused.size) return;
      start();
    },
    cancel() { cancelled = true; clearTimeout(timer); },
  };
}
