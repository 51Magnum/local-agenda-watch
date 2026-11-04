import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {noticeTimer} from "./notice-timer";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it("dismisses once at four seconds, not before", () => {
  const close = vi.fn(); noticeTimer(close);
  vi.advanceTimersByTime(3999); expect(close).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(close).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(4000); expect(close).toHaveBeenCalledTimes(1);
});
it.each(["hover", "focus"])("pauses on %s and resumes only the remaining time", reason => {
  const close = vi.fn(), timer = noticeTimer(close);
  vi.advanceTimersByTime(1500); timer.pause(reason); vi.advanceTimersByTime(10000);
  expect(close).not.toHaveBeenCalled(); timer.resume(reason);
  vi.advanceTimersByTime(2499); expect(close).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1); expect(close).toHaveBeenCalledOnce();
});
it("does not resume when hover ends while keyboard focus remains inside", () => {
  const close = vi.fn(), timer = noticeTimer(close);
  vi.advanceTimersByTime(1000); timer.pause("hover"); timer.pause("focus");
  timer.resume("hover"); vi.advanceTimersByTime(8000); expect(close).not.toHaveBeenCalled();
  timer.resume("focus"); vi.advanceTimersByTime(3000); expect(close).toHaveBeenCalledOnce();
});
it("ignores duplicate and unrelated resume events", () => {
  const close = vi.fn(), timer = noticeTimer(close);
  vi.advanceTimersByTime(1000); timer.pause("focus"); timer.pause("focus");
  timer.resume("hover"); vi.advanceTimersByTime(4000); expect(close).not.toHaveBeenCalled();
  timer.resume("focus"); timer.resume("focus"); vi.advanceTimersByTime(3000); expect(close).toHaveBeenCalledOnce();
});
it("cancels pending dismissal on manual close, replacement, or unmount", () => {
  const close = vi.fn(), timer = noticeTimer(close);
  timer.cancel(); timer.pause("hover"); timer.resume("hover");
  vi.advanceTimersByTime(10000); expect(close).not.toHaveBeenCalled();
});
