"use client";
import {residentDateText} from "@/lib/areas/format";
import {projectPolygonFeature} from "@/lib/maps/project-feature";
import {resolveProjectHit} from "@/lib/maps/project-hit";
import {loadAreaBoundaries} from "@/lib/maps/boundary-client";
import { PROJECT_FILL_OPACITY, PROJECT_POLYGON_LAYERS } from "@/lib/maps/project-style";
import FLUM_TILES from "@/public/flum/manifest.json";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Map as LibreMap, GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { bbox, circle, distance } from "@turf/turf";
import dynamic from "next/dynamic";
import {
  MAP_STAGES,
  STAGE_COLORS,
  isLonLat,
  type MapCase,
  type MapVisual,
  type AddressResult,
} from "@/lib/maps/types";
import {
  gridCells,
  zoomTier,
  CASE_OUTLINE_ZOOM,
  caseInFilter,
  type ViewportData,
  type Bounds,
  type MapAreaInfo,
  commonStageLabel,
} from "@/lib/maps/viewport";

import type { PaneData } from "@/lib/maps/project-questions";
import { unpackViewport } from "@/lib/maps/viewport-wire";
import ThemeSelector from "../theme-selector";
import ProjectFinder from "./project-finder";
const AlertForm = dynamic(()=>import("../alert-form"));
const InterestForm = dynamic(() => import("../locations/interest-form"));
const ProjectPane = dynamic(() => import("./project-pane"));
import MapImageViewer from "./map-image-viewer";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import "./map-home.css";
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
const VIEW_KEY = "law:map-view:v1",
  PLACE_KEY = "law:saved-place:v1";

type Place = { label: string; coordinates: [number, number]; radius: number };
function updatePlaceUrl(p: Place) {
  const u = new URL(window.location.href);
  u.searchParams.set("lng", String(p.coordinates[0]));
  u.searchParams.set("lat", String(p.coordinates[1]));
  u.searchParams.set("q", p.label);
  u.searchParams.set("r", String(p.radius));
  window.history.replaceState(window.history.state, "", u);
}
function readPlace(): Place | undefined {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE_KEY) ?? "null");
    if (
      p &&
      typeof p.label === "string" &&
      isLonLat(p.coordinates) &&
      p.radius >= 0.25 &&
      p.radius <= 10
    )
      return p;
  } catch {}
}
function projectFromUrl() {
  const q = new URLSearchParams(window.location.search).get("project");
  return q && /^[a-z-]+\/[A-Z0-9-]+$/.test(q) ? q : undefined;
}

export default function MapHome() {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null),
    tooltip = useRef<HTMLDivElement>(null),
    generation = useRef(0),
    loadRef = useRef<() => void>(() => {}),
    features = useRef(new Map<string, MapCase>()),
    selectedRef = useRef<string | undefined>(undefined),
    openRef = useRef<(c: MapCase) => void>(() => {}),
    choosePlaceRef = useRef<(p: Place) => void>(() => {}),
    dropPinRef = useRef(false),
    cache = useRef(new Map<string, ViewportData>()),
    inflight = useRef(new Map<string, Promise<ViewportData>>()),
    revision = useRef("initial"),
    destroyed = useRef(false),
    lastTooltip = useRef("");
  const [areas, setAreas] = useState<MapAreaInfo[]>([]),
    [coverage, setCoverage] = useState<string[]>([]);
  const [ready, setReady] = useState(false),
    [cases, setCases] = useState<MapCase[]>([]),
    [undatedDecisions,setUndatedDecisions] = useState(0),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<string>(),
    [pane, setPane] = useState<PaneData>(),
    [paneError, setPaneError] = useState(""),
    [loading, setLoading] = useState(true),
    [flumLoading, setFlumLoading] = useState(false),
    [message, setMessage] = useState(""),
    [flumOn, setFlumOn] = useState(false),
    [boundariesOn, setBoundariesOn] = useState(true),
    [menu, setMenu] = useState(false),
    [dialog, setDialog] = useState<"watch" | "coverage">(),
    [image, setImage] = useState<MapVisual>(),
    [address, setAddress] = useState(""),
    [searching, setSearching] = useState(false),
    [results, setResults] = useState<AddressResult[]>([]),
    [place, setPlace] = useState<Place>(),
    [savedPlace, setSavedPlace] = useState<Place>(),
    [droppingPin, setDroppingPin] = useState(false),
    [limited, setLimited] = useState(false),
    [zoom, setZoom] = useState(10),
    [layers, setLayers] = useState(false),
    [legend, setLegend] = useState(false);
  const filterRef = useRef(filter),
    flumRef = useRef(flumOn);
  useEffect(() => {
    filterRef.current = filter;
    loadRef.current();
  }, [filter]);
  useEffect(() => {
    flumRef.current = flumOn;
  }, [flumOn]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  function closePane() {
    const u = new URL(window.location.href);
    u.searchParams.delete("project");
    window.history.replaceState(
      { ...window.history.state, lawPane: false },
      "",
      u,
    );
    selectedRef.current = undefined;
    setSelected(undefined);
    setPane(undefined);
    setPaneError("");
    map.current?.getCanvas().focus();
  }
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        if (dialog) setDialog(undefined);
        else if (selected) closePane();
        else {
          setMenu(false);
          setLayers(false);
          setLegend(false);
        }
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  });
  useEffect(() => {
    if (!selected) return;
    const abort = new AbortController();
    const [area, id] = selected.split("/");
    fetch("/api/map/project?" + new URLSearchParams({ area, case: id }), {
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error("Project details are temporarily unavailable.");
        return r.json() as Promise<PaneData>;
      })
      .then((data) => {
        if (abort.signal.aborted) return;
        const loaded = [...features.current.values()].find(
          (c) =>
            c.id === area + ":" + id ||
            c.members?.some((m) => m.areaId === area && m.caseId === id),
        );
        if (loaded?.members && !data.item.members?.length) {
          data.item.members = loaded.members;
          data.caseIds = [
            ...new Set([
              ...data.caseIds,
              ...loaded.members.map((m) => m.caseId),
            ]),
          ];
        }
        const canonical = data.area.id + "/" + data.item.id;
        if (canonical !== selected) {
          const url = new URL(window.location.href); url.searchParams.set("project", canonical);
          window.history.replaceState({ ...window.history.state, lawPane: true }, "", url);
          selectedRef.current = canonical;
          setSelected(canonical);
        }
        setPane(data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setPaneError(e.message);
      });
    return () => abort.abort();
  }, [selected]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    if (!selected) {
      m.easeTo({ padding: 0, duration: 200 });
      return;
    }
    // Selection changes before its details arrive. Never position the camera
    // using the previous project's pane, or finish its in-flight animation.
    m.stop();
    if (!pane || selected !== pane.area.id + "/" + pane.item.id) return;
    const center = pane?.item.centroid;
    if (center) {
      const mobile = window.innerWidth < 700;
      m.easeTo({
        center,
        zoom: Math.max(14, m.getZoom()),
        padding: mobile
          ? {
              top: 25,
              left: 20,
              right: 20,
              bottom: Math.min(window.innerHeight * 0.45, 350),
            }
          : { top: 50, left: 450, right: 60, bottom: 40 },
        duration: 500,
      });
    }
  }, [ready, pane, selected]);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.querySelector<HTMLElement>(".law-interest-dialog");
    root?.querySelector<HTMLElement>("button,input,select,textarea")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !root) return;
      const items = [
        ...root.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href]",
        ),
      ].filter((el) => el.tabIndex >= 0 && el.offsetParent !== null);
      const first = items[0],
        last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [dialog]);
  useEffect(() => {
    destroyed.current = false;
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    if (projectFromUrl() && !window.history.state?.lawPane) {
      const shared = new URL(window.location.href),
        base = new URL(shared);
      base.searchParams.delete("project");
      window.history.replaceState(
        { ...window.history.state, lawMapBase: true },
        "",
        base,
      );
      window.history.pushState(
        { ...window.history.state, lawPane: true },
        "",
        shared,
      );
    }
    const restore = () => setSelected(projectFromUrl());
    restore();
    window.addEventListener("popstate", restore);
    // Start metadata alongside the renderer, rather than after it downloads.
    const metadata = fetch("/api/map/meta").then((r) => {
      if (!r.ok) throw Error("Map metadata unavailable");
      return r.json();
    });
    void metadata.catch(() => {});
    // Yield two frames so the search/header paint before renderer initialization.
    new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      .then(() => disposed ? undefined : import("maplibre-gl")).then(
      (lib) => {
        if (disposed || !lib || !container.current) return;
        lib.setWorkerUrl("/maplibre/worker.mjs");
        if (window.innerWidth < 700) lib.setWorkerCount(1);
        let center: [number, number] = [-116.5, 43.6],
          initialZoom = 10;
        const saved = readPlace();
        if (saved) {
          setSavedPlace(saved);
          setPlace(saved);
          center = saved.coordinates;
          initialZoom = 13;
        } else
          try {
            const view = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null");
            if (view && isLonLat(view.center) && Number.isFinite(view.zoom)) {
              center = view.center;
              initialZoom = Math.max(2, Math.min(18, view.zoom));
            }
          } catch {}
        const u = new URL(window.location.href),
          lng = Number(u.searchParams.get("lng")),
          lat = Number(u.searchParams.get("lat"));
        if (
          u.searchParams.has("lng") &&
          u.searchParams.has("lat") &&
          isLonLat([lng, lat])
        ) {
          const p = {
            label: u.searchParams.get("q") ?? "Map pin",
            coordinates: [lng, lat] as [number, number],
            radius: Math.max(
              0.25,
              Math.min(10, Number(u.searchParams.get("r")) || 1),
            ),
          };
          setPlace(p);
          setAddress(p.label);
          center = p.coordinates;
          initialZoom = 13;
        }
        const m = new lib.Map({
          container: container.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center,
          zoom: initialZoom,
          minZoom: 2,
          maxZoom: 19,
          renderWorldCopies: false,
          attributionControl: false,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        });
        map.current = m;
        m.scrollZoom.setWheelZoomRate(1 / 900);
        m.addControl(
          new lib.NavigationControl({ showCompass: false }),
          "top-right",
        );
        m.addControl(
          new lib.AttributionControl({ compact: true }),
          "bottom-right",
        );
        m.once("style.load", () => {
          if (disposed) return;
          m.addSource("law-boundaries", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          m.addLayer({
            id: "law-boundaries",
            type: "line",
            source: "law-boundaries",
            paint: {
              "line-color": "#0f766e",
              "line-opacity": 0.35,
              "line-width": 1.2,
            },
          });
          m.addSource("law-area-labels", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          m.addLayer({
            id: "law-area-labels",
            type: "symbol",
            source: "law-area-labels",
            minzoom: 9,
            maxzoom: 14,
            layout: {
              "text-field": ["get", "name"],
              "text-size": 12,
              "text-font": ["Noto Sans Regular"],
            },
            paint: {
              "text-color": "#0f766e",
              "text-halo-color": "#ffffff",
              "text-halo-width": 2,
            },
          });
          m.addSource("law-uncovered", { type: "geojson", data: empty });
          m.addLayer({
            id: "law-uncovered",
            type: "fill",
            source: "law-uncovered",
            paint: { "fill-color": "#64748b", "fill-opacity": 0.16 },
          });
          m.on("dataloading", (e) => {
            if ("sourceId" in e && e.sourceId === "law-flum" && flumRef.current)
              setFlumLoading(true);
          });
          m.on("sourcedata", (e) => {
            if (e.sourceId === "law-flum" && m.isSourceLoaded("law-flum"))
              setFlumLoading(false);
          });
          m.on("error", (e) => {
            if ("sourceId" in e && e.sourceId === "law-flum") {
              setFlumLoading(false);
              setMessage(
                "Future land use tiles could not load. Try reloading the map.",
              );
            }
          });
          m.addSource("law-ring", { type: "geojson", data: empty });
          m.addLayer({
            id: "law-ring",
            type: "line",
            source: "law-ring",
            paint: {
              "line-color": "#0f766e",
              "line-width": 2,
              "line-dasharray": [3, 2],
            },
          });
          m.addSource("law-polygons", { type: "geojson", data: empty });
          for (const layer of PROJECT_POLYGON_LAYERS) m.addLayer(layer);
          m.addSource("law-points", {
            type: "geojson",
            data: empty,
            cluster: true,
            clusterRadius: 45,
            clusterMaxZoom: CASE_OUTLINE_ZOOM - 1,
          });
          m.addLayer({
            id: "law-clusters",
            minzoom: 9,
            maxzoom: 24,
            type: "circle",
            source: "law-points",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#0f766e",
              "circle-radius": 20,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            },
          });
          m.addLayer({
            id: "law-cluster-count",
            minzoom: 9,
            maxzoom: 24,
            type: "symbol",
            source: "law-points",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
              "text-font": ["Noto Sans Regular"],
            },
            paint: { "text-color": "#ffffff" },
          });
          m.addLayer({
            id: "law-dots",
            minzoom: 9,
            maxzoom: 24,
            type: "circle",
            source: "law-points",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": 7,
              "circle-color": ["get", "color"],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });
          m.addSource("law-summaries", {
            type: "geojson",
            data: empty,
            cluster: true,
            clusterRadius: 38,
            clusterMaxZoom: 8,
            clusterProperties: {
              count: ["+", ["get", "count"]],
              upcoming: ["+", ["get", "upcoming"]],
            },
          });
          m.addLayer({
            id: "law-summary-dots",
            maxzoom: 9,
            type: "circle",
            source: "law-summaries",
            paint: {
              "circle-radius": 25,
              "circle-color": "#0f766e",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 2,
            },
          });
          m.addLayer({
            id: "law-summary-count",
            maxzoom: 9,
            type: "symbol",
            source: "law-summaries",
            layout: {
              "text-field": ["to-string", ["get", "count"]],
              "text-size": 13,
              "text-font": ["Noto Sans Regular"],
            },
            paint: { "text-color": "#fff" },
          });
          setReady(true);
          loadRef.current();
        });
        const hideTip = () => {
          if (tooltip.current) tooltip.current.hidden = true;
          m.getCanvas().style.cursor = dropPinRef.current ? "crosshair" : "";
        };
        m.on("mousemove", (e) => {
          if (dropPinRef.current) { hideTip(); return; }
          if (!m.getSource("law-polygons") || e.originalEvent.buttons) {
            hideTip();
            return;
          }
          const hits = m.queryRenderedFeatures(e.point, {
            layers: [
              "law-fill",
              "law-outline",
              "law-dots",
              "law-summary-dots",
              "law-clusters",
            ],
          });
          const resolved=resolveProjectHit(hits,id=>features.current.get(id),c=>c.geometry);
          const hit=resolved?.hit??hits.find(h=>["law-clusters","law-summary-dots"].includes(h.layer.id));
          if (!hit) {
            hideTip();
            return;
          }
          m.getCanvas().style.cursor = "pointer";
          const c = resolved?.item,
            text = c
              ? (c.popup?.headline ?? c.title) +
                (c.nextHearing ? " · " + residentDateText(c.nextHearing.label,c.timezone) : "")
              : hit.layer.id === "law-summary-dots"
                ? hit.properties?.name +
                  " · " +
                  hit.properties?.count +
                  " active · " +
                  hit.properties?.upcoming +
                  " upcoming hearings"
                : "Click to zoom";
          if (tooltip.current) {
            if (lastTooltip.current !== text) {
              tooltip.current.textContent = text;
              lastTooltip.current = text;
            }
            tooltip.current.hidden = false;
            tooltip.current.style.left =
              Math.max(
                8,
                Math.min(e.point.x + 16, m.getContainer().clientWidth - 280),
              ) + "px";
            tooltip.current.style.top = Math.max(8, e.point.y - 48) + "px";
          }
        });
        m.getCanvas().addEventListener("mouseleave", hideTip);
        m.on("movestart", hideTip);
        m.on("click", async (e) => {
          if (dropPinRef.current) {
            dropPinRef.current = false;
            setDroppingPin(false);
            closePane();
            choosePlaceRef.current({label:"Selected map location",coordinates:[e.lngLat.lng,e.lngLat.lat],radius:1});
            return;
          }
          if (!m.getLayer("law-dots")) return;
          hideTip();
          const hits = m.queryRenderedFeatures(e.point, {
            layers: [
              "law-dots",
              "law-clusters",
              "law-fill",
              "law-outline",
              "law-summary-dots",
            ],
          });
          const resolved=resolveProjectHit(hits,id=>features.current.get(id),c=>c.geometry);
          const hit=resolved?.hit??hits.find(h=>["law-clusters","law-summary-dots"].includes(h.layer.id));
          if (hit) {
            if (hit.layer.id === "law-clusters") {
              const z = await (
                m.getSource("law-points") as GeoJSONSource
              ).getClusterExpansionZoom(Number(hit.properties?.cluster_id));
              m.easeTo({
                center: (
                  hit.geometry as unknown as { coordinates: [number, number] }
                ).coordinates,
                zoom: z,
              });
              return;
            }
            if (hit.layer.id === "law-summary-dots") {
              if (hit.properties?.cluster_id) {
                const z = await (
                  m.getSource("law-summaries") as GeoJSONSource
                ).getClusterExpansionZoom(Number(hit.properties.cluster_id));
                m.easeTo({
                  center: (
                    hit.geometry as unknown as { coordinates: [number, number] }
                  ).coordinates,
                  zoom: z,
                });
                return;
              }
              const bounds = JSON.parse(
                String(hit.properties?.bounds ?? "null"),
              );
              if (bounds)
                m.fitBounds(bounds as Bounds, { padding: 65, maxZoom: 12 });
              return;
            }
            const c = resolved?.item;
            if (c) {
              openRef.current(c);
              return;
            }
          }
          if (flumRef.current && m.getLayer("law-flum")) {
            const f = m.queryRenderedFeatures(e.point, {
              layers: ["law-flum"],
            })[0];
            if (f) {
              setMessage(
                String(f.properties?.jurisdiction) +
                  " · " +
                  String(f.properties?.category),
              );
              return;
            }
          }
          const response = await fetch("/api/map/coverage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              coordinates: [e.lngLat.lng, e.lngLat.lat],
              radius: 0.01,
            }),
          });
          const covered = await response.json();
          if (!covered.areas?.length) {
            setCoverage([]);
            setPlace({
              label: "Selected map location",
              coordinates: [e.lngLat.lng, e.lngLat.lat],
              radius: 1,
            });
            setDialog("coverage");
          }
        });
        m.on("moveend", () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            try {
              localStorage.setItem(
                VIEW_KEY,
                JSON.stringify({
                  center: m.getCenter().toArray(),
                  zoom: m.getZoom(),
                }),
              );
            } catch {}
            loadRef.current();
          }, 300);
        });
        metadata
          .then((data) => {
            setAreas(data.areas ?? []);
            revision.current = data.revision ?? "initial";
            cache.current.clear();
            loadRef.current();
          })
          .catch(() => {
            revision.current = "unavailable";
            loadRef.current();
          });
      },
    );
    return () => {
      disposed = true;
      destroyed.current = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("popstate", restore);
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    openRef.current = (c) => {
      const member = c.members?.[0],
        key = member
          ? member.areaId + "/" + member.caseId
          : (c.areaId ?? c.id.split(":")[0]) + "/" + c.id.split(":").at(-1);
      if (key === selectedRef.current) return;
      const u = new URL(window.location.href);
      u.searchParams.set("project", key);
      window.history.pushState(
        { ...window.history.state, lawPane: true },
        "",
        u,
      );
      setSelected(key);
    };
    loadRef.current = async () => {
      const m = map.current;
      if (!m || !m.getSource("law-polygons") || revision.current === "initial")
        return;
      const current = ++generation.current,
        z = zoomTier(m.getZoom()),
        b = m.getBounds(),
        bounds = [
          Math.max(-180, b.getWest()),
          Math.max(-85, b.getSouth()),
          Math.min(180, b.getEast()),
          Math.min(85, b.getNorth()),
        ] as Bounds,
        cells = gridCells(bounds, z);
      setZoom(z);
      setLoading(true);
      const boundaryRequest=loadAreaBoundaries();
      void boundaryRequest.then((d) => {
        if (current === generation.current && !destroyed.current) {
          (m.getSource("law-boundaries") as GeoJSONSource)?.setData(d.polygons);
          (m.getSource("law-area-labels") as GeoJSONSource)?.setData(d.labels);
          (m.getSource("law-uncovered") as GeoJSONSource)?.setData(d.uncovered);
        }
      }).catch(() => {});
      try {
        const responses = await Promise.all(
          cells.map(async (cell) => {
            const key = cell.join(",") + "@" + z;
            if (cache.current.has(key)) return cache.current.get(key)!;
            let promise = inflight.current.get(key);
            if (!promise) {
              promise = fetch(
                "/api/map/cases?" +
                  new URLSearchParams({
                    bbox: cell.join(","),
                    zoom: String(z),
                    compact: "1",
                    v:"resident-policy-v1",
                  }),
              )
                .then(async (r) => {
                  if (!r.ok)
                    throw Error("Map data is temporarily unavailable.");
                  const data = unpackViewport(await r.json());
                  cache.current.set(key, data);
                  if (cache.current.size > 100)
                    cache.current.delete(cache.current.keys().next().value!);
                  return data;
                })
                .finally(() => inflight.current.delete(key));
              inflight.current.set(key, promise);
            }
            return promise;
          }),
        );
        if (current !== generation.current || destroyed.current) return;
        const found = new Map<string, MapCase>();
        for (const response of responses)
          for (const c of response.cases) found.set(c.id, c);
        features.current = found;
        const all = [...found.values()],
          visible = all.filter((c) => caseInFilter(c, filterRef.current));
        setUndatedDecisions(all.filter(c=>["Decided","Recorded"].includes(c.stage)&&!c.decisionDate).length);
        setCases(visible);
        setLimited(responses.some((r) => r.truncated) || visible.length > 1000);
        const shown = visible.slice(0, 1000);
        (m.getSource("law-polygons") as GeoJSONSource).setData({
          type: "FeatureCollection",
          features: shown
            .filter((c) => c.geometry)
            .map(c=>projectPolygonFeature(c.id,c.geometry!,{
              color:STAGE_COLORS[c.stage],approximate:c.confidence==="approximate"
            })),
        });
        (m.getSource("law-points") as GeoJSONSource).setData({
          type: "FeatureCollection",
          features:
            z >= 9
              ? shown
                  .filter(
                    (c) => c.centroid && (z < CASE_OUTLINE_ZOOM || !c.geometry),
                  )
                  .map((c) => ({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: c.centroid! },
                    properties: { id: String(c.id), color: STAGE_COLORS[c.stage] },
                  }))
              : [],
        });
        const summaries = [
          ...new Map(
            responses.flatMap((r) => r.summaries).map((s) => [s.id, s]),
          ).values(),
        ];
        (m.getSource("law-summaries") as GeoJSONSource).setData({
          type: "FeatureCollection",
          features:
            z < 9
              ? summaries.map((s) => ({
                  type: "Feature",
                  geometry: { type: "Point", coordinates: s.center },
                  properties: {
                    id: s.id,
                    name: s.name,
                    count: s.count,
                    upcoming: s.upcoming,
                    bounds: s.bounds,
                  },
                }))
              : [],
        });
      } catch (e) {
        if (current === generation.current) setMessage((e as Error).message);
      } finally {
        if (current === generation.current) {
          setLoading(false);
        }
      }
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    let cancelled = false;
    const showFlum = flumOn && zoom >= FLUM_TILES.minZoom;
    if (showFlum && !m.getSource("law-flum")) {
      setFlumLoading(true);
      void import("pmtiles").then(async ({ Protocol }) => {
        const lib = await import("maplibre-gl");
        if (cancelled || destroyed.current || m.getSource("law-flum")) return;
        lib.addProtocol("pmtiles", new Protocol().tile);
        m.addSource("law-flum", { type: "vector", url: "pmtiles://" + new URL(FLUM_TILES.url, window.location.origin).href });
        m.addLayer({ id: "law-flum", type: "fill", source: "law-flum", "source-layer": FLUM_TILES.sourceLayer, minzoom: FLUM_TILES.minZoom,
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.35 } }, "law-ring");
      }).catch(() => { if (!cancelled) { setFlumLoading(false); setMessage("Future land use could not load. Try again."); } });
    } else if (m.getLayer("law-flum")) {
      m.setLayoutProperty("law-flum", "visibility", showFlum ? "visible" : "none");
    }
    // Map source visibility is external state; reset its loading indicator when hidden.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!showFlum) setFlumLoading(false);
    m.setPaintProperty(
      "law-fill",
      "fill-opacity",
      flumOn ? 0 : PROJECT_FILL_OPACITY,
    );
    for (const id of ["law-boundaries", "law-area-labels"])
      m.setLayoutProperty(id, "visibility", boundariesOn ? "visible" : "none");
    return () => { cancelled = true; };
  }, [ready, flumOn, boundariesOn, zoom]);
  useEffect(() => {
    if (!place || !ready || !map.current) return;
    const m = map.current;
    let marker: import("maplibre-gl").Marker | undefined,
      cancelled = false;
    import("maplibre-gl").then((lib) => {
      if (destroyed.current || cancelled) return;
      marker = new lib.Marker({ color: "#0f766e", draggable: true })
        .setLngLat(place.coordinates)
        .addTo(m);
      marker.on("dragend", () => {
        const point = marker!.getLngLat();
        choosePlaceRef.current({label:"Selected map location",coordinates:[point.lng,point.lat],radius:place.radius});
      });
      marker.getElement().setAttribute("aria-label", "Selected area pin. Drag to move. Not a subscription status.");
    });
    (m.getSource("law-ring") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [circle(place.coordinates, place.radius, { units: "miles" })],
    });
    return () => {
      cancelled = true;
      marker?.remove();
      if (m.getSource("law-ring"))
        (m.getSource("law-ring") as GeoJSONSource).setData(empty);
    };
  }, [place, ready]);
  useEffect(() => {
    if (map.current) map.current.getCanvas().style.cursor = droppingPin ? "crosshair" : "";
  }, [droppingPin, ready]);
  function choosePlace(p: Place) {
    setPlace(p);
    setAddress(p.label);
    setResults([]);
    setMessage("");
    updatePlaceUrl(p);
    map.current?.fitBounds(
      bbox(circle(p.coordinates, p.radius, { units: "miles" })) as Bounds,
      { padding: 70, maxZoom: 14 },
    );
    fetch("/api/map/coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: p.coordinates, radius: p.radius }),
    })
      .then((r) => r.json())
      .then((d) => {
        setCoverage(d.areas ?? []);
        if (!d.areas?.length) setDialog("coverage");
      })
      .catch(() => {});
  }
  function clearPlace() {
    setPlace(undefined);
    setSavedPlace(undefined);
    setAddress("");
    setCoverage([]);
    dropPinRef.current = false;
    setDroppingPin(false);
    const u = new URL(window.location.href);
    for (const key of ["lat", "lng", "q", "r"]) u.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", u);
    try {
      localStorage.removeItem(PLACE_KEY);
      setMessage("Pin and circle cleared. Your email watches are unchanged.");
    } catch {
      setMessage("Pin and circle cleared for this visit. This browser could not remove its saved place. Your email watches are unchanged.");
    }
    map.current?.getCanvas().focus();
  }
  async function search() {
    if (address.trim().length < 2) return;
    setSearching(true);
    setMessage("");
    try {
      const key = "law:home-search:" + address.trim().toLowerCase(),
        cached = sessionStorage.getItem(key);
      let matches: AddressResult[] = cached ? JSON.parse(cached) : [];
      if (!cached) {
        const r = await fetch("/api/locations/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: address.trim() }),
          signal: AbortSignal.timeout(12000),
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        matches = d.results;
        sessionStorage.setItem(key, JSON.stringify(matches));
      }
      if (matches.length === 1) choosePlace({ ...matches[0], radius: 1 });
      else if (matches.length) setResults(matches);
      else setMessage("No matching address found. Try a city and state.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setSearching(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setMessage("Location is unavailable in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        choosePlace({
          label: "My location",
          coordinates: [p.coords.longitude, p.coords.latitude],
          radius: 1,
        }),
      () =>
        setMessage(
          "Location was not shared. You can search an address instead.",
        ),
      { timeout: 10000, maximumAge: 300000 },
    );
  }
  useEffect(() => { choosePlaceRef.current = choosePlace; });
  const nearby = place
    ? cases
        .filter((c) => c.centroid)
        .map((c) => ({
          ...c,
          miles: distance(place.coordinates, c.centroid!, { units: "miles" }),
        }))
        .filter((c) => c.miles <= place.radius)
        .sort((a, b) => a.miles - b.miles)
    : [];
  const visiblePane =
    pane && selected === pane.area.id + "/" + pane.item.id ? pane : undefined;
  const watchPlace =
    place ??
    (visiblePane?.item.centroid
      ? {
          label: visiblePane.item.popup?.projectName ?? visiblePane.item.title,
          coordinates: visiblePane.item.centroid,
          radius: 1,
        }
      : undefined);
  return (
    <main className="law-map-home">
      <h1 className="sr-only">Development projects near you</h1>
      <header className="law-map-header">
        <Link href="/" prefetch={false} className="law-map-brand">
          Local Agenda <strong>Watch</strong>
          <small>What’s being built near you?</small>
        </Link>
        <form
          className="law-global-search"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <label className="sr-only" htmlFor="global-address">
            Enter an address or city
          </label>
          <input
            id="global-address"
            placeholder="Enter an address or city"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button disabled={searching} aria-label="Search address">
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        <button
          className="law-watch-address"
          onClick={() =>
            watchPlace
              ? setDialog("watch")
              : setMessage(
                  "Search an address or open a project to choose a place to watch.",
                )
          }
        >
          Watch an address
        </button>
        <button
          aria-label="Menu"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          ☰
        </button>
      </header>
      <div className="law-explorer-stage">
        <div
          ref={container}
          className="law-explorer-canvas"
          aria-label="Development projects map"
        />
        <div ref={tooltip} hidden className="law-map-tooltip" role="tooltip" />
        <nav className="law-filter-chips" aria-label="Filter projects">
          {[
            ["hearings", "Upcoming hearings"],
            ["decided", "Decided last 30 days"],
            ["homes", "Homes"],
            ["business", "Commercial / Industrial"],
            ["all", "All"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        {filter==="decided"&&<p className="law-undated-decisions" role="status">{undatedDecisions} decided projects in this map view excluded because no decision date is verified.</p>}
        <div className="law-explorer-controls">
          <button aria-pressed={droppingPin} onClick={() => {
            dropPinRef.current = !droppingPin;
            setDroppingPin(!droppingPin);
            setMessage(droppingPin ? "" : "Click or tap the map to place a pin, then choose a radius and watch this area.");
          }}>{droppingPin ? "Cancel pin" : "Drop a pin"}</button>
          <button aria-expanded={legend} aria-controls="map-progress-legend" onClick={() => { setLegend(!legend); setLayers(false); }}>
            Legend
          </button>
          <button aria-expanded={layers} aria-controls="map-layer-options" onClick={() => { setLayers(!layers); setLegend(false); }}>
            Layers
          </button>
          <button aria-label="Use my location" onClick={locate}>
            ◎
          </button>
        </div>
        {place && <button className="law-clear-place" onClick={clearPlace}>Clear pin &amp; circle</button>}
        {legend && (
          <section id="map-progress-legend" className="law-map-legend" aria-label="Map legend">
            <strong>Project progress</strong>
            {MAP_STAGES.map((stage) => (
              <p key={stage}>
                <span style={{ background: STAGE_COLORS[stage] }} />
                {commonStageLabel(stage)}
              </p>
            ))}
            {flumOn && (
              <>
                <strong>Future land use</strong>
                {FLUM_TILES.legend.map((l) => (
                  <p key={l.value}>
                    <span style={{ background: l.color }} />
                    {l.label}
                  </p>
                ))}
              </>
            )}
          </section>
        )}
        {layers && (
          <section id="map-layer-options" className="law-layer-panel" aria-label="Map layers">
            <label>
              <input
                type="checkbox"
                checked={flumOn}
                onChange={(e) => setFlumOn(e.target.checked)}
              />{" "}
              Future land use
            </label>
            <label>
              <input
                type="checkbox"
                checked={boundariesOn}
                onChange={(e) => setBoundariesOn(e.target.checked)}
              />{" "}
              Jurisdiction boundaries
            </label>
            {flumOn && (
              <small>
                {zoom < FLUM_TILES.minZoom
                  ? "Zoom in to see land-use plans."
                  : "Published plan coverage; county plan elsewhere."}
              </small>
            )}
          </section>
        )}
        {results.length > 0 && (
          <div className="law-search-results">
            {results.map((r, i) => (
              <button key={i} onClick={() => choosePlace({ ...r, radius: 1 })}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        {menu && (
          <nav className="law-map-menu" aria-label="Site menu">
            <ProjectFinder onSelect={(project) => {
              const key = project.areaId + "/" + project.caseId;
              if (key !== selectedRef.current) {
                const url = new URL(window.location.href);
                url.searchParams.set("project", key);
                window.history.pushState({ ...window.history.state, lawPane: true }, "", url);
                setSelected(key);
              }
              setMenu(false);
            }} />
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <ThemeSelector />
          </nav>
        )}
        {selected && !visiblePane && (
          <section className="law-pane-loading" role="status">
            {paneError || "Loading project…"}
            <button onClick={closePane}>Close</button>
          </section>
        )}
        {visiblePane && (
          <ProjectPane
            key={selected}
            data={visiblePane}
            onClose={closePane}
            onImage={setImage}
            savedPlace={
              (place ?? savedPlace) && visiblePane.item.centroid
                ? {
                    distance: distance(
                      (place ?? savedPlace)!.coordinates,
                      visiblePane.item.centroid,
                      { units: "miles" },
                    ),
                  }
                : undefined
            }
            onWatch={() => {
              if (!visiblePane.item.centroid) {
                setMessage("This project has no verified map location. Search an address or drop a pin to choose an area.");
                return;
              }
              const p = {label:visiblePane.item.popup?.projectName ?? visiblePane.item.title,coordinates:visiblePane.item.centroid,radius:1};
              setPlace(p);
              setAddress(p.label);
              setDialog("watch");
            }}
          />
        )}
        {!selected && (
          <div className="law-map-help">
            {zoom < 9
              ? "Choose an area to explore projects"
              : <><span className="law-pointer-hint">Hover to preview · Click for project details</span><span className="law-touch-hint">Tap to preview project details</span></>}
          </div>
        )}
        {place && !selected && (
          <details className="law-nearby-projects">
            <summary>
              Selected area: {place.label} · {place.radius} mi{" "}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  clearPlace();
                }}
              >
                Clear pin &amp; circle
              </button>
            </summary>
            <p>The pin and circle show your selected area, not email subscription status. Only the latest place is remembered in this browser. The unsubscribe link in your email stops all alerts for that email address.</p>
            <label>Radius
              <select value={place.radius} onChange={e => choosePlace({...place,radius:Number(e.target.value)})}>
                {[...new Set([0.25,0.5,1,2,3,5,10,place.radius])].sort((a,b)=>a-b).map(r=><option key={r} value={r}>{r} {r===1?"mile":"miles"}</option>)}
              </select>
            </label>
            <button onClick={()=>setDialog("watch")}>Watch this area</button>
            <p>{nearby.length} projects in this map view within this radius.</p>
            {nearby.map((c) => (
              <button key={c.id} onClick={() => openRef.current(c)}>
                {c.title}{c.aiTitle&&<span className="ml-2 text-xs text-zinc-500">AI title</span>}
                <small>
                  {c.miles.toFixed(1)} mi ·{" "}
                  {c.areaId ? areas.find((a) => a.id === c.areaId)?.name : ""}
                  {c.nextHearing ? " · " + residentDateText(c.nextHearing.label,c.timezone) : ""}
                </small>
              </button>
            ))}
          </details>
        )}
        {(loading || (flumOn && flumLoading)) && (
          <p className="law-map-loading" role="status">
            {flumLoading ? "Loading future land use…" : "Loading projects…"}
          </p>
        )}
        {limited && (
          <p className="law-map-limit">
            Zoom in to see all projects; this view is limited to 1,000.
          </p>
        )}
        {message && (
          <div className="law-map-message" role="status">
            {message}
            <button aria-label="Dismiss message" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        <footer className="law-map-footer">
          <span>Independent summary; official records control.</span>
          <button
            onClick={() => {
              setDialog("coverage");
              if (!place && map.current)
                setPlace({
                  label: "Selected map area",
                  coordinates: map.current.getCenter().toArray() as [
                    number,
                    number,
                  ],
                  radius: 1,
                });
            }}
          >
            Not covered yet? Request it
          </button>
        </footer>
      </div>
      {image && (
        <MapImageViewer visual={image} onClose={() => setImage(undefined)} />
      )}
      {dialog && (
        <div
          className="law-interest-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialog(undefined);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              dialog === "watch" ? "Watch a place" : "Request coverage"
            }
            className="law-interest-dialog"
          >
            <button
              className="law-pane-close"
              aria-label="Close form"
              onClick={() => setDialog(undefined)}
            >
              ×
            </button>
            <h2>
              {dialog === "watch"
                ? "Watch this place"
                : "Not covered yet — request it"}
            </h2>
            <p>
              {watchPlace?.label ??
                "Tell us which area you would like us to track."}
            </p>
            {dialog==="watch"&&watchPlace&&<label className="law-watch-radius">Watch radius
              <select value={watchPlace.radius} onChange={e=>setPlace({...watchPlace,radius:Number(e.target.value)})}>
                {[...new Set([0.25,0.5,1,2,3,5,10,watchPlace.radius])].sort((a,b)=>a-b).map(r=><option key={r} value={r}>{r} {r===1?"mile":"miles"}</option>)}
              </select>
              <small>Choose the area before requesting a confirmation. Changing this selection does not edit an existing email watch.</small>
            </label>}
            {dialog==="watch"&&watchPlace?<AlertForm target={{kind:"place",label:watchPlace.label,coordinates:watchPlace.coordinates,radiusMiles:watchPlace.radius??1}} onSaved={()=>{
              setSavedPlace(watchPlace);
              setPlace(watchPlace);
              updatePlaceUrl(watchPlace);
              try{localStorage.setItem(PLACE_KEY,JSON.stringify(watchPlace));}catch{}
              setDialog(undefined);
              setMessage("Check your email to confirm. Alerts start only after confirmation.");
              map.current?.getCanvas().focus();
            }}/>:<InterestForm
              key={dialog + (watchPlace?.label ?? "")}
              kind={dialog === "watch" ? "follow" : "coverage"}
              areaName={
                watchPlace ? coverage.join(" / ") || watchPlace.label : ""
              }
              coordinates={watchPlace?.coordinates}
              radiusMiles={watchPlace?.radius ?? 1}
              place={Boolean(watchPlace)}
              onSaved={() => {
                if (dialog === "watch" && watchPlace) {
                  try {
                    localStorage.setItem(PLACE_KEY, JSON.stringify(watchPlace));
                    setSavedPlace(watchPlace);
                  } catch {
                    setMessage(
                      "Your signup was saved, but this browser could not remember the place.",
                    );
                  }
                }
              }}
            />}
          </section>
        </div>
      )}
    </main>
  );
}
