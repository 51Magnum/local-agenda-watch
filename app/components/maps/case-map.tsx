"use client";
import { movingToPopup, type ScreenPoint } from "@/lib/maps/popup-hover";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LibreMap, Popup, GeoJSONSource, ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { bbox, circle } from "@turf/turf";
import { MAP_STAGES, STAGE_COLORS, type AddressResult, type MapCase, type PublicMapData, type FlumCache, type MapVisual } from "@/lib/maps/types";
import { geometryCentroid, nearbyCases } from "@/lib/maps/spatial";
import { createMapPin, readSharedSearch, searchAddress, searchHash } from "@/lib/maps/address-search";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import MapImageViewer from "./map-image-viewer";
import { isWatching, setWatching, subscribeWatches, watchFromCase } from "@/lib/watches";
const popupDisposers = new WeakMap<HTMLElement, () => void>();
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
function caseFeatures(cases: MapCase[]): FeatureCollection {
  return { type: "FeatureCollection", features: cases.filter((c) => c.geometry && !c.citywide).map((c) => ({ type: "Feature", geometry: c.geometry!, properties: { id: c.id, color: c.statusNote ? "#64748b" : STAGE_COLORS[c.stage], approximate: c.confidence === "approximate" } })) };
}
// Use text nodes, rather than HTML strings, for all city-supplied content.
function popupContent(item: MapCase, onEnlarge: (visual: MapVisual) => void, jurisdiction: string, catalog: MapCase[]): HTMLElement {
  const card = document.createElement("article"); card.className = "law-project-popup";
  const title = document.createElement("a"); title.href = item.href; title.className = "law-popup-title"; title.textContent = item.title; card.append(title);
  const watchedProject = watchFromCase(jurisdiction, item, catalog);
  const watchLabel = document.createElement("label"); watchLabel.className = "law-watch-toggle";
  const watch = document.createElement("input"); watch.type = "checkbox"; watch.checked = isWatching(watchedProject); watch.setAttribute("aria-label", "Watch " + item.title);
  const watchText = document.createElement("span"); watchText.textContent = "Watch"; watchLabel.append(watch, watchText);
  watchLabel.addEventListener("click", (event) => event.stopPropagation());
  const watchError = document.createElement("p"); watchError.setAttribute("role", "status"); watchError.hidden = true;
  watch.addEventListener("change", () => { try { setWatching(watchedProject, watch.checked); watchError.hidden = true; } catch (error) { watch.checked = isWatching(watchedProject); watchError.textContent = error instanceof Error ? error.message : "Could not save your watch."; watchError.hidden = false; } });
  popupDisposers.set(card, subscribeWatches(() => { watch.checked = isWatching(watchedProject); }));
  if (item.visual) {
    const exhibit = item.visual;
    const figure = document.createElement("figure"); figure.className = "law-popup-visual";
    const enlarge = document.createElement("button"); enlarge.type = "button"; enlarge.className = "law-popup-image-button"; enlarge.setAttribute("aria-label", "Enlarge " + exhibit.label); enlarge.addEventListener("click", (event) => { event.stopPropagation(); onEnlarge(exhibit); });
    const image = document.createElement("img"); image.src = "/_next/image?" + new URLSearchParams({ url: exhibit.src, w: "384", q: "75" }); image.alt = exhibit.alt; image.width = 260; image.height = 170; image.decoding = "async";
    // A missing exhibit must not leave a broken image or hide the case details.
    image.addEventListener("error", () => figure.remove(), { once: true });
    enlarge.append(image); figure.append(enlarge);
    const caption = document.createElement("figcaption");
    const source = document.createElement("a"); source.href = exhibit.sourceUrl; source.target = "_blank"; source.rel = "noopener noreferrer"; source.textContent = exhibit.label; caption.append(source);
    if (exhibit.note) { const note = document.createElement("span"); note.textContent = exhibit.note; caption.append(note); }
    figure.append(caption); card.append(figure);
  }
  const status = document.createElement("p"); status.className = "law-popup-status"; status.textContent = item.statusNote ?? item.stage; card.append(status);
  if (item.summary) { const summary = document.createElement("p"); summary.textContent = item.summary; card.append(summary); }
  if (item.nextHearing) { const hearing = document.createElement("p"); hearing.className = "law-popup-hearing"; hearing.textContent = item.nextHearing.label; card.append(hearing); }
  if (item.confidence === "approximate") { const note = document.createElement("p"); note.textContent = "Approximate boundary"; card.append(note); }
  const link = document.createElement("a"); link.href = item.href; link.textContent = "View project →";
  const footer = document.createElement("div"); footer.className = "law-popup-footer"; footer.append(link, watchLabel); card.append(footer, watchError);
  return card;
}
export default function CaseMap({ jurisdiction, caseIds, compact = false, fullPage = false, matchHeightTo }: { jurisdiction: string; caseIds?: readonly string[]; compact?: boolean; fullPage?: boolean; matchHeightTo?: string }) {
  const [expandedImage, setExpandedImage] = useState<MapVisual>();
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const [data, setData] = useState<PublicMapData>(); const [error, setError] = useState("");
  const [hiddenStages, setHiddenStages] = useState<string[]>([]);
  const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);
  const [withinMile, setWithinMile] = useState(false);
  const [placingPin, setPlacingPin] = useState(false);
  const pinMode = useRef(false);
  const applyMapPin = useRef<((coordinates: [number, number]) => void) | null>(null);
  const searchGeneration = useRef(0);
  const [flumOn, setFlumOn] = useState(false); const [flum, setFlum] = useState<FlumCache>();
  const [address, setAddress] = useState(""); const [searching, setSearching] = useState(false); const [searchMessage, setSearchMessage] = useState(""); const [results, setResults] = useState<AddressResult[]>([]); const [location, setLocation] = useState<AddressResult>();
  const openProject = useRef<((id: string) => void) | null>(null);
  const container = useRef<HTMLDivElement>(null); const map = useRef<LibreMap | null>(null); const popup = useRef<Popup | null>(null); const [ready, setReady] = useState(false);
  const idsKey = caseIds?.join(",") ?? "";
  useEffect(() => {
    const canvas = container.current;
    const card = matchHeightTo ? document.querySelector(matchHeightTo) : null;
    if (!canvas || !card) return;
    const matchSize = () => {
      const height = card.getBoundingClientRect().height;
      if (height > 0) canvas.style.height = height + "px";
    };
    matchSize();
    const observer = new ResizeObserver(matchSize); observer.observe(card);
    return () => { observer.disconnect(); canvas.style.height = ""; };
  }, [data, matchHeightTo]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/maps/" + encodeURIComponent(jurisdiction), { signal: abort.signal, cache: "no-cache" }).then(async (r) => { if (!r.ok) throw new Error("Map data is temporarily unavailable."); setData(await r.json()); }).catch((e) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [jurisdiction]);
  useEffect(() => {
    if (compact) return;
    const restore = () => { const shared = readSharedSearch(window.location.hash); if (shared) { setLocation(shared); setAddress(shared.source === "map" ? "" : shared.label); setWithinMile(new URLSearchParams(window.location.hash.slice(1)).get("nearby") === "1"); } };
    restore(); window.addEventListener("hashchange", restore); return () => window.removeEventListener("hashchange", restore);
  }, [compact]);
  useEffect(() => {
    applyMapPin.current = (coordinates) => {
      const pin = createMapPin(coordinates);
      searchGeneration.current += 1;
      setSearching(false); setLocation(pin); setAddress(""); setResults([]); setSearchMessage("");
      pinMode.current = false; setPlacingPin(false);
      if (map.current) map.current.getCanvas().style.cursor = "";
      popup.current?.remove();
      window.history.replaceState(null, "", window.location.pathname + window.location.search + searchHash(pin) + (withinMile ? "&nearby=1" : ""));
    };
  }, [withinMile]);
  function togglePinMode() {
    const active = !pinMode.current; pinMode.current = active; setPlacingPin(active);
    popup.current?.remove(); setResults([]); setSearchMessage("");
    if (map.current) map.current.getCanvas().style.cursor = active ? "crosshair" : "";
  }
  const filtered = useMemo(() => data?.cases.filter((c) => (!idsKey || idsKey.split(",").includes(c.id)) && !hiddenStages.includes(c.stage) && !hiddenTypes.includes(c.type)) ?? [], [data, idsKey, hiddenStages, hiddenTypes]);
  const cases = useMemo(() => withinMile && location ? nearbyCases(filtered, location.coordinates) : filtered, [filtered, withinMile, location]);
  const mapped = cases.filter((c) => c.geometry && !c.citywide);
  useEffect(() => {
    if (!data || !container.current) return;
    let disposed = false, pinned = false, hovered = "";
    let hoverOrigin: ScreenPoint | null = null, previousPointer: ScreenPoint | null = null;
    let instance: LibreMap | undefined; let observer: ResizeObserver | undefined;
    const closeHover = () => { if (!pinned) { popup.current?.remove(); hovered = ""; } };
    import("maplibre-gl").then((lib) => {
      if (disposed || !container.current) return;
      lib.setWorkerUrl("/maplibre/worker.mjs");
      instance = new lib.Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/liberty", center: data.jurisdiction.center, zoom: data.jurisdiction.zoom, attributionControl: false, scrollZoom: !compact, cooperativeGestures: compact }); map.current = instance;
      instance.scrollZoom.setWheelZoomRate(1 / 900);
      instance.scrollZoom.setZoomRate(1 / 200);
      instance.addControl(new lib.NavigationControl(), "top-right");
      instance.addControl(new lib.AttributionControl({ compact: true, customAttribution: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" }));
      function sizePopup() {
        if (!instance || !popup.current?.getElement().classList.contains("law-case-popup")) return;
        const element = popup.current.getElement(), viewport = instance.getContainer();
        element.style.setProperty("--law-popup-content-height", Math.max(140, viewport.clientHeight * 0.8 - 36) + "px");
        const bounds = element.getBoundingClientRect(), point = instance.project(popup.current.getLngLat());
        const clamp = (value: number, half: number, total: number) => Math.max(half + 16, Math.min(total - half - 16, value));
        popup.current.setOffset([clamp(point.x, bounds.width / 2, viewport.clientWidth) - point.x, clamp(point.y, bounds.height / 2, viewport.clientHeight) - point.y]);
      }
      function show(content: HTMLElement, coordinates: [number, number], projectCard = false) {
        popup.current?.remove();
        const next = new lib.Popup({ closeButton: true, closeOnClick: false, maxWidth: projectCard ? "none" : "300px", className: projectCard ? "law-case-popup" : "", anchor: projectCard ? "center" : undefined, offset: projectCard ? 0 : 12, focusAfterOpen: pinned }).setLngLat(coordinates).setDOMContent(content).addTo(instance!);
        popup.current = next;
        sizePopup();
        next.getElement().addEventListener("mouseleave", closeHover);
        next.on("close", () => { popupDisposers.get(content)?.(); popupDisposers.delete(content); if (popup.current === next) { popup.current = null; hovered = ""; pinned = false; } });
      }
      function showProject(item: MapCase) {
        if (!item.geometry || !data) return;
        show(popupContent(item, setExpandedImage, data.jurisdiction.id, data.cases), item.centroid ?? geometryCentroid(item.geometry), true);
      }
      openProject.current = (id) => {
        const item = data.cases.find((c) => c.id === id); if (!item?.geometry || !instance) return;
        const b = bbox(item.geometry);
        popup.current?.remove(); pinned = true;
        instance.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 70, maxZoom: 15 });
        showProject(item); hovered = id;
      };
      instance.on("load", () => {
        if (!instance) return;
        instance.addSource("flum", { type: "geojson", data: empty }); instance.addLayer({ id: "flum-fill", type: "fill", source: "flum", paint: { "fill-color": "#94a3b8", "fill-opacity": 0.35 } });
        instance.addSource("cases", { type: "geojson", data: empty });
        instance.addLayer({ id: "case-fill", type: "fill", source: "cases", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.2 } });
        instance.addLayer({ id: "case-halo", type: "line", source: "cases", filter: ["==", ["get", "approximate"], false], paint: { "line-color": "#ffffff", "line-width": 7 } });
        instance.addLayer({ id: "case-approx-halo", type: "line", source: "cases", filter: ["==", ["get", "approximate"], true], paint: { "line-color": "#ffffff", "line-width": 7, "line-dasharray": [8 / 7, 8 / 7] } });
        instance.addLayer({ id: "case-line", type: "line", source: "cases", filter: ["==", ["get", "approximate"], false], paint: { "line-color": ["get", "color"], "line-width": 4 } });
        instance.addLayer({ id: "case-approx", type: "line", source: "cases", filter: ["==", ["get", "approximate"], true], paint: { "line-color": ["get", "color"], "line-width": 4, "line-dasharray": [2, 2] } });
        instance.addSource("search", { type: "geojson", data: empty });
        instance.addLayer({ id: "search-ring", type: "line", source: "search", filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": "#0f766e", "line-width": 2, "line-dasharray": [3, 2] } });
        instance.addLayer({ id: "search-pin", type: "circle", source: "search", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 8, "circle-color": "#0f766e", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
        setReady(true);
      });
      instance.on("mousemove", (event) => {
        if (!instance?.getLayer("case-fill")) return;
        if (pinMode.current) { instance.getCanvas().style.cursor = "crosshair"; return; }
        const hit = instance.queryRenderedFeatures(event.point, { layers: ["case-fill", "case-line", "case-approx", "case-halo", "case-approx-halo"] })[0];
        instance.getCanvas().style.cursor = hit ? "pointer" : "";
        if (compact || pinned) return;
        const pointer = { x: event.originalEvent.clientX, y: event.originalEvent.clientY };
        if (!hit) {
          const card = popup.current?.getElement();
          const crossing = card && hoverOrigin && previousPointer && movingToPopup(hoverOrigin, previousPointer, pointer, card.getBoundingClientRect());
          previousPointer = pointer;
          if (!crossing) closeHover();
          return;
        }
        hoverOrigin = pointer; previousPointer = pointer;
        const id = String(hit.properties.id); if (hovered === id && popup.current) return;
        const item = data.cases.find((c) => c.id === id); if (!item) return;
        showProject(item); hovered = id;
      });
      instance.getCanvas().addEventListener("mouseleave", (event) => {
        // The pointer corridor covers empty map space on the way to the card.
        // Leaving the canvas anywhere except the card still closes immediately.
        if (!(event.relatedTarget instanceof Node) || !popup.current?.getElement().contains(event.relatedTarget)) closeHover();
      });
      instance.on("click", (event) => {
        if (!instance?.getLayer("case-fill")) return;
        if (pinMode.current) { applyMapPin.current?.([event.lngLat.lng, event.lngLat.lat]); return; }
        const hits = instance.queryRenderedFeatures(event.point, { layers: ["case-fill", "case-line", "case-approx", "case-halo", "case-approx-halo", "flum-fill"] });
        const hit = hits.find((f) => f.properties?.id); const item = hit && data.cases.find((c) => c.id === String(hit.properties.id));
        popup.current?.remove(); pinned = true;
        if (item) { showProject(item); hovered = item.id; }
        else {
          const land = hits.find((f) => f.layer.id === "flum-fill");
          if (land) { const content = document.createElement("div"); content.className = "law-project-popup"; const title = document.createElement("strong"); title.textContent = String(land.properties[data.flum.categoryField] ?? "Unknown"); const label = document.createElement("p"); label.textContent = "Future land use"; content.append(title, label); show(content, [event.lngLat.lng, event.lngLat.lat]); }
          else pinned = false;
        }
      });
      instance.getCanvas().addEventListener("keydown", (event) => { if (event.key === "Escape") popup.current?.remove(); });
      instance.on("move", sizePopup);
      observer = new ResizeObserver(() => { instance?.resize(); sizePopup(); }); observer.observe(container.current);
    }).catch(() => setError("The map could not load. Browse cases from the city page."));
    return () => { disposed = true; observer?.disconnect(); popup.current?.remove(); openProject.current = null; instance?.remove(); map.current = null; setReady(false); };
  }, [data, compact]);
  useEffect(() => {
    if (!ready || !map.current) return;
    popup.current?.remove(); (map.current.getSource("cases") as GeoJSONSource)?.setData(caseFeatures(cases));
    if (compact && cases.some((c) => c.geometry)) { const b = bbox(caseFeatures(cases)); map.current.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 35, maxZoom: 15, duration: 0 }); }
  }, [ready, cases, compact]);
  useEffect(() => {
    if (!flumOn || flum) return;
    const abort = new AbortController();
    fetch("/api/maps/" + encodeURIComponent(jurisdiction) + "?layer=flum", { signal: abort.signal }).then(async (r) => { if (!r.ok) throw new Error(); setFlum(await r.json()); }).catch(() => { if (!abort.signal.aborted) setSearchMessage("Future land use is temporarily unavailable."); });
    return () => abort.abort();
  }, [flumOn, flum, jurisdiction]);
  useEffect(() => {
    if (!ready || !map.current || !data) return;
    // Keep the transparent fill layer for hit testing across the whole project.
    map.current.setPaintProperty("case-fill", "fill-opacity", flumOn ? 0 : 0.2);
    (map.current.getSource("flum") as GeoJSONSource)?.setData(flumOn && flum ? flum.geojson : empty);
    if (data.flum.legend.length) map.current.setPaintProperty("flum-fill", "fill-color", ["match", ["get", data.flum.categoryField], data.flum.legend[0].value, data.flum.legend[0].color, ...data.flum.legend.slice(1).flatMap((c) => [c.value, c.color]), "#94a3b8"] as ExpressionSpecification);
  }, [ready, flumOn, flum, data]);
  useEffect(() => {
    if (!ready || !map.current) return;
    popup.current?.remove();
    const ring = location ? circle(location.coordinates, 1, { units: "miles", steps: 80 }) : undefined;
    (map.current.getSource("search") as GeoJSONSource)?.setData(location && ring ? { type: "FeatureCollection", features: [...(withinMile ? [ring] : []), { type: "Feature", geometry: { type: "Point", coordinates: location.coordinates }, properties: {} }] } : empty);
  }, [ready, location, withinMile]);
  useEffect(() => {
    if (!ready || !map.current || !location) return;
    const b = bbox(circle(location.coordinates, 1, { units: "miles", steps: 80 })); map.current.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 45 });
  }, [ready, location]);
  function locationUrl(result: AddressResult, nearby = withinMile) { return window.location.pathname + window.location.search + searchHash(result) + (nearby ? "&nearby=1" : ""); }
  function choose(result: AddressResult) { setLocation(result); setResults([]); setSearchMessage(""); window.history.replaceState(null, "", locationUrl(result)); }
  function toggleNearby(checked: boolean) {
    setWithinMile(checked);
    if (!location) return;
    window.history.replaceState(null, "", locationUrl(location, checked));
    if (checked && map.current) {
      const b = bbox(circle(location.coordinates, 1, { units: "miles", steps: 80 }));
      map.current.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 45 });
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!data || address.trim().length < 3) return;
    const generation = ++searchGeneration.current;
    if (pinMode.current) togglePinMode();
    setSearching(true); setSearchMessage("");
    try { const matches = await searchAddress(data.jurisdiction, address.trim()); if (generation !== searchGeneration.current) return; setResults(matches); if (matches.length === 1) choose(matches[0]); else setSearchMessage(matches.length ? "Choose an address." : "No address found. Try adding the city."); }
    catch { if (generation === searchGeneration.current) setSearchMessage("Address search is temporarily unavailable."); } finally { if (generation === searchGeneration.current) setSearching(false); }
  }
  async function share() { try { const path = location ? locationUrl(location) : window.location.pathname + window.location.search; await navigator.clipboard.writeText(window.location.origin + path); setSearchMessage(""); setLinkCopied(true); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setLinkCopied(false), 2000); } catch { setSearchMessage("Copy this page’s URL to share."); } }
  function clearLocation() { searchGeneration.current += 1; setSearching(false); if (pinMode.current) togglePinMode(); setLocation(undefined); setAddress(""); setWithinMile(false); setSearchMessage(""); window.history.replaceState(null, "", window.location.pathname + window.location.search); }
  const mapInfo = data && (<details className={compact ? "law-map-stage-key law-project-map-key" : "law-map-info"}><summary>Map key & sources</summary><div className="law-map-info-content">
          {compact && <div className="law-map-legend" aria-label="Case stage legend">{MAP_STAGES.map((s) => <span key={s}><i style={{ background: STAGE_COLORS[s] }}/>{s}</span>)}<span>┄ Approximate boundary</span></div>}
          {flumOn && <div className="law-map-legend" aria-label="Future land use legend">{data.flum.legend.map((c) => <span key={c.value}><i style={{ background: c.color }}/>{c.label}</span>)}</div>}
          <p><a href={data.flum.layerUrl + "?f=pjson"}>{data.flum.label}</a>{data.flum.adoptedDate && <> · <a href={data.flum.adoptionSource}>Adopted {data.flum.adoptedDate}</a></>}. Future land use is separate from zoning. {data.flum.dataNote}</p>
          <p>Updated {new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updatedAt))} (Mountain time).</p>{data.warnings.map((w) => <p key={w}>{w}</p>)}
          {!compact && <label>Find a project <select aria-label="Find a project" defaultValue="" onChange={(e) => openProject.current?.(e.target.value)}><option value="">Choose a project</option>{mapped.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
        </div></details>);
  return <section id={compact ? "case-location-map" : "case-map"} className={"law-map" + (compact ? " law-map-compact" : "") + (fullPage ? " law-map-full" : "") + (matchHeightTo ? " law-map-match-card" : "")} aria-label="Development map" onKeyDown={(e) => { if (e.key === "Escape" && pinMode.current) { e.preventDefault(); togglePinMode(); } }}>
    {!fullPage && <div className="law-map-heading"><h2>{compact ? "Project map" : "Development map"}</h2>{!compact && <a href={"/" + jurisdiction + "#case-map"}>Open map →</a>}</div>}
    {error && <p role="status">{error}</p>}{!data && !error && <p role="status">Loading map…</p>}
    {data && <>
      <div className="law-map-toolbar">
        {!compact && <form className="law-search" onSubmit={submit} aria-busy={searching}><label className="sr-only" htmlFor={"map-address-" + jurisdiction}>Find an address in {data.jurisdiction.name}</label><input id={"map-address-" + jurisdiction} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={location?.source === "map" ? location.label : "Search an address"} maxLength={200} minLength={3} required autoComplete="street-address"/><button disabled={searching} type="submit">{searching && <span className="law-search-spinner" aria-hidden="true"/>}{searching ? "Searching..." : "Search"}</button><button type="button" className="law-pin-control" disabled={!ready && location?.source !== "map"} aria-pressed={location?.source === "map" && !placingPin ? undefined : placingPin} onClick={location?.source === "map" && !placingPin ? clearLocation : togglePinMode}>{placingPin ? "Cancel pin" : location?.source === "map" ? "Clear pin" : "Drop pin"}</button><button type="button" onClick={share}>Copy link</button>{location && location.source !== "map" && <button type="button" onClick={clearLocation} title="Remove the address and one-mile filter">Clear address</button>}</form>}
        <div className="law-map-toggles">
          {!compact && <label title={location ? "Show only projects within one mile of your selected location" : "Search an address or drop a pin first"}><input type="checkbox" checked={withinMile} disabled={!location} onChange={(e) => toggleNearby(e.target.checked)}/> Within 1 mile</label>}
          <label><input type="checkbox" checked={flumOn} onChange={(e) => setFlumOn(e.target.checked)}/> Future land use</label>
          {!compact && <details className="law-filter-menu" onPointerEnter={(e) => { if (e.pointerType === "mouse") e.currentTarget.open = true; }} onPointerLeave={(e) => { if (e.pointerType === "mouse") e.currentTarget.open = false; }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }} onKeyDown={(e) => { if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus(); } }}><summary className="law-filter-button"><span aria-hidden="true">☷</span> Filters{hiddenStages.length + hiddenTypes.length > 0 ? " •" : ""}</summary><div>
            <div className="law-filter-groups">
              <fieldset><legend>Stage</legend>
                <label className="law-filter-all"><input type="checkbox" checked={hiddenStages.length === 0} onChange={(e) => setHiddenStages(e.target.checked ? [] : [...MAP_STAGES])}/> All stages</label>
                {MAP_STAGES.map((stage) => <label key={stage}><input type="checkbox" checked={!hiddenStages.includes(stage)} onChange={(e) => setHiddenStages((current) => e.target.checked ? current.filter((s) => s !== stage) : [...current, stage])}/><i className="law-stage-swatch" style={{ background: STAGE_COLORS[stage] }}/>{stage}</label>)}
              </fieldset>
              <fieldset><legend>Case type</legend>
                <label className="law-filter-all"><input type="checkbox" checked={hiddenTypes.length === 0} onChange={(e) => setHiddenTypes(e.target.checked ? [] : [...new Set(data.cases.map((c) => c.type))])}/> All case types</label>
                {[...new Map(data.cases.map((c) => [c.type, c.typeLabel])).entries()].sort((a,b) => a[1].localeCompare(b[1])).map(([id, label]) => <label key={id}><input type="checkbox" checked={!hiddenTypes.includes(id)} onChange={(e) => setHiddenTypes((current) => e.target.checked ? current.filter((t) => t !== id) : [...current, id])}/>{label}</label>)}
              </fieldset>
            </div>
            <label className="law-hide-decided"><input type="checkbox" checked={hiddenStages.includes("Decided") && hiddenStages.includes("Recorded")} onChange={(e) => setHiddenStages((current) => e.target.checked ? [...new Set([...current, "Decided", "Recorded"])] : current.filter((s) => s !== "Decided" && s !== "Recorded"))}/> Hide decided & recorded</label>
          </div></details>}
        </div>
      </div>
      <p className={searching ? "sr-only" : "law-live-message"} role="status">{searching ? "Searching..." : searchMessage}</p>
      {results.length > 1 && <div className="law-address-results">{results.map((r, i) => <button key={i} type="button" onClick={() => choose(r)}>{r.label}</button>)}</div>}
      <div className="law-map-surface"><div ref={container} className="law-map-canvas" role="region" aria-label={compact ? "Interactive project map. Click or tap an outline for details." : "Interactive project map. Hover or tap an outline for details."}/><span className="law-map-hint" role={placingPin ? "status" : undefined}>{placingPin ? "Click map to place pin · Esc to cancel" : compact ? "Click a boundary for details" : "Hover or tap a project"}</span>{!compact && <details className="law-map-stage-key" open><summary>Stages</summary><div className="law-map-legend" aria-label="Case stage legend">{MAP_STAGES.map((s) => <span key={s}><i style={{ background: STAGE_COLORS[s] }}/>{s}</span>)}<span>┄ Approximate boundary</span></div></details>}{compact && mapInfo}</div>
      {!compact && <div className="law-map-bottom"><span>{mapped.length} projects shown</span>{!fullPage && <a href={"/" + jurisdiction + "#all-cases"} onClick={() => { const list = document.getElementById("all-cases"); if (list instanceof HTMLDetailsElement) list.open = true; }}>All cases</a>}
        {mapInfo}
      </div>}
      {compact && <p className="law-map-source"><strong>Future land use:</strong> {[...new Set(cases.flatMap((c) => c.flumCategories))].join("; ") || "Not yet available"}</p>}
      {withinMile && !mapped.length && <p role="status">No projects within 1 mile match your filters.</p>}
    </>}
    {linkCopied && <div className="law-copy-toast" role="status"><span aria-hidden="true">✓</span> Link copied</div>}
    {expandedImage && <MapImageViewer visual={expandedImage} onClose={() => setExpandedImage(undefined)} />}
  </section>;
}
