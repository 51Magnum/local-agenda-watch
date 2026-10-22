"use client";
import { useState } from "react";

export default function ShareProject({ title, summary }: { title?: string; summary?: string }) {
  const [message, setMessage] = useState("");
  async function copyLink() {
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    const share = { title: title ?? document.title, text: summary ?? "", url: url.href };
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share(share);
        setMessage("Share options opened");
        return;
      }
      await navigator.clipboard.writeText(url.href);
      setMessage("Link copied");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMessage("Copy the page address from your browser to share this page.");
    }
  }
  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" onClick={copyLink} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 focus-visible:outline-2 dark:border-zinc-700 dark:hover:bg-zinc-900">Share with a neighbor</button>
    <span role="status" className="text-sm text-zinc-500 dark:text-zinc-400">{message}</span>
  </div>;
}
