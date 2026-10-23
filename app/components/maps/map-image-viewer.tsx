"use client";
import { useEffect, useRef } from "react";
import type { MapVisual } from "@/lib/maps/types";

export default function MapImageViewer({ visual, onClose }: { visual: MapVisual; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.documentElement.style.overflow;
    element?.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => { element?.close(); document.documentElement.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={dialog} className="law-image-viewer" aria-label={visual.label}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <button type="button" className="law-image-close" aria-label="Close enlarged image" onClick={onClose}>×</button>
    <figure>
      {/* Render the complete source at its natural aspect ratio; no crop or inferred dimensions. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={visual.fullSizeUrl} alt={visual.alt} />
      <figcaption>{visual.label}{visual.note && <span>{visual.note}</span>}</figcaption>
    </figure>
  </dialog>;
}
