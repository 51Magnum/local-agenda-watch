"use client";
import { useState } from "react";
import type { WatchTarget } from "@/lib/alerts";
export default function AlertForm({
  target,
  onSaved,
}: {
  target: WatchTarget;
  onSaved?: () => void;
}) {
  const [email, setEmail] = useState(""),
    [website, setWebsite] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await fetch("/api/alerts/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, target, website }),
            }),
            d = await r.json();
          if (!r.ok) throw Error(d.error);
          setMessage(d.message);
          onSaved?.();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Try again later");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        {target.kind === "project"
          ? "Get a daily email when this project changes."
          : "Watch all tracked jurisdictions within " +
            target.radiusMiles +
            " miles of " +
            target.label +
            "."}
      </p>
      <label className="block">
        Email (required)
        <input
          className="block w-full rounded border p-3"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label hidden aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>
      <button className="rounded border px-4 py-2" disabled={busy}>
        {busy ? "Sending…" : "Email me a confirmation"}
      </button>
      <p className="text-sm">
        No alerts until you confirm. Unsubscribe anytime. Your saved location is
        not published.
      </p>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
