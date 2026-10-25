"use client";
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
  type FlumCache,
} from "@/lib/maps/types";
import {
  gridCells,
  zoomTier,
  caseInFilter,
  type ViewportData,
  type Bounds,
  type MapAreaInfo,
  commonStageLabel,
} from "@/lib/maps/viewport";

import type { PaneData } from "@/lib/maps/project-questions";
import ThemeSelector from "../theme-selector";
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
    cache = useRef(new Map<string, ViewportData>()),
    inflight = useRef(new Map<string, Promise<ViewportData>>()),
    flumCache = useRef(new Map<string, FlumCache>()),
    revision = useRef("initial"),
    destroyed = useRef(false),
    lastTooltip = useRef("");
  const [areas, setAreas] = useState<MapAreaInfo[]>([]),
    [coverage, setCoverage] = useState<string[]>([]);
  const [ready, setReady] = useState(false),
    [cases, setCases] = useState<MapCase[]>([]),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<string>(),
    [pane, setPane] = useState<PaneData>(),
    [paneError, setPaneError] = useState(""),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [flumOn, setFlumOn] = useState(false),
    [boundariesOn, setBoundariesOn] = useState(true),
    [flum, setFlum] = useState<FlumCache>(),
    [menu, setMenu] = useState(false),
    [dialog, setDialog] = useState<"watch" | "coverage">(),
    [image, setImage] = useState<MapVisual>(),
    [address, setAddress] = useState(""),
    [searching, setSearching] = useState(false),
    [results, setResults] = useState<AddressResult[]>([]),
    [place, setPlace] = useState<Place>(),
    [savedPlace, setSavedPlace] = useState<Place>(),
    [limited, setLimited] = useState(false),
    [zoom, setZoom] = useState(10),
    [layers, setLayers] = useState(false),
    [legend, setLegend] = useState(false);
  const filterRef = useRef(filter),
    flumRef = useRef(flumOn);
  useEffect(() => {
    filterRef.current = filter;
    flumRef.current = flumOn;
    loadRef.current();
  }, [filter, flumOn]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  function closePane() {
    if (window.history.state?.lawPane) window.history.back();
    else {
      const u = new URL(window.location.href);
      u.searchParams.delete("project");
      window.history.replaceState(null, "", u);
      setSelected(undefined);
      setPane(undefined);
    }
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
        if (loaded?.members) {
          data.item.members = loaded.members;
          data.caseIds = [
            ...new Set([
              ...data.caseIds,
              ...loaded.members.map((m) => m.caseId),
            ]),
          ];
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
      window.history.replaceState({ lawMapBase: true }, "", base);
      window.history.pushState({ lawPane: true }, "", shared);
    }
    const restore = () => setSelected(projectFromUrl());
    restore();
    window.addEventListener("popstate", restore);
    import("maplibre-gl").then((lib) => {
      if (disposed || !container.current) return;
      lib.setWorkerUrl("/maplibre/worker.mjs");
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
      m.on("load", () => {
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
        m.addSource("law-flum", { type: "geojson", data: empty });
        m.addLayer({
          id: "law-flum",
          type: "fill",
          source: "law-flum",
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.35 },
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
        m.addLayer({
          id: "law-fill",
          type: "fill",
          source: "law-polygons",
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.16 },
        });
        m.addLayer({
          id: "law-halo",
          type: "line",
          source: "law-polygons",
          paint: { "line-color": "#ffffff", "line-width": 6 },
        });
        m.addLayer({
          id: "law-outline",
          type: "line",
          source: "law-polygons",
          paint: { "line-color": ["get", "color"], "line-width": 3 },
        });
        m.addLayer({
          id: "law-approximate",
          type: "line",
          source: "law-polygons",
          filter: ["==", ["get", "approximate"], true],
          paint: {
            "line-color": "#ffffff",
            "line-width": 2,
            "line-dasharray": [3, 2],
          },
        });
        m.addSource("law-points", {
          type: "geojson",
          data: empty,
          cluster: true,
          clusterRadius: 45,
          clusterMaxZoom: 13,
        });
        m.addLayer({
          id: "law-clusters",
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
          type: "symbol",
          source: "law-points",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
          },
          paint: { "text-color": "#ffffff" },
        });
        m.addLayer({
          id: "law-dots",
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
          type: "symbol",
          source: "law-summaries",
          layout: {
            "text-field": ["to-string", ["get", "count"]],
            "text-size": 13,
          },
          paint: { "text-color": "#fff" },
        });
        setReady(true);
        loadRef.current();
      });
      const hideTip = () => {
        if (tooltip.current) tooltip.current.hidden = true;
        m.getCanvas().style.cursor = "";
      };
      m.on("mousemove", (e) => {
        if (!m.isStyleLoaded() || e.originalEvent.buttons) {
          hideTip();
          return;
        }
        const hit = m.queryRenderedFeatures(e.point, {
          layers: [
            "law-fill",
            "law-outline",
            "law-dots",
            "law-summary-dots",
            "law-clusters",
          ],
        })[0];
        if (!hit) {
          hideTip();
          return;
        }
        m.getCanvas().style.cursor = "pointer";
        const c = features.current.get(String(hit.properties?.id)),
          text = c
            ? (c.popup?.headline ?? c.title) +
              (c.nextHearing ? " · " + c.nextHearing.label : "")
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
        if (!m.getLayer("law-dots")) return;
        hideTip();
        const hit = m.queryRenderedFeatures(e.point, {
          layers: [
            "law-dots",
            "law-clusters",
            "law-fill",
            "law-outline",
            "law-summary-dots",
          ],
        })[0];
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
            const bounds = JSON.parse(String(hit.properties?.bounds ?? "null"));
            if (bounds)
              m.fitBounds(bounds as Bounds, { padding: 65, maxZoom: 12 });
            return;
          }
          const c = features.current.get(String(hit.properties?.id));
          if (c) {
            openRef.current(c);
            return;
          }
        }
        if (flumRef.current) {
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
      fetch("/api/map/meta")
        .then((r) => r.json())
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
    });
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
      window.history.pushState({ lawPane: true }, "", u);
      setSelected(key);
    };
    loadRef.current = async () => {
      const m = map.current;
      if (!m || !m.isStyleLoaded() || revision.current === "initial") return;
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
      fetch(
        "/api/map/boundaries?" +
          new URLSearchParams({ bbox: bounds.join(",") }),
      )
        .then((r) => r.json())
        .then((d) => {
          if (current === generation.current && !destroyed.current) {
            (m.getSource("law-boundaries") as GeoJSONSource)?.setData(
              d.polygons,
            );
            (m.getSource("law-area-labels") as GeoJSONSource)?.setData(
              d.labels,
            );
            (m.getSource("law-uncovered") as GeoJSONSource)?.setData(
              d.uncovered,
            );
          }
        })
        .catch(() => {});
      try {
        const responses = await Promise.all(
          cells.map(async (cell) => {
            const key = cell.join(",") + "@" + z + "@" + revision.current;
            if (cache.current.has(key)) return cache.current.get(key)!;
            let promise = inflight.current.get(key);
            if (!promise) {
              promise = fetch(
                "/api/map/cases?" +
                  new URLSearchParams({
                    bbox: cell.join(","),
                    zoom: String(z),
                    v: revision.current,
                  }),
              )
                .then(async (r) => {
                  if (!r.ok)
                    throw Error("Map data is temporarily unavailable.");
                  const data = (await r.json()) as ViewportData;
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
        setCases(visible);
        setLimited(responses.some((r) => r.truncated) || visible.length > 1000);
        const shown = visible.slice(0, 1000);
        (m.getSource("law-polygons") as GeoJSONSource).setData({
          type: "FeatureCollection",
          features: shown
            .filter((c) => c.geometry)
            .map((c) => ({
              type: "Feature",
              geometry: c.geometry!,
              properties: {
                id: c.id,
                color: STAGE_COLORS[c.stage],
                approximate: c.confidence === "approximate",
              },
            })),
        });
        (m.getSource("law-points") as GeoJSONSource).setData({
          type: "FeatureCollection",
          features:
            z >= 9 && z < 14
              ? shown
                  .filter((c) => c.centroid)
                  .map((c) => ({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: c.centroid! },
                    properties: { id: c.id, color: STAGE_COLORS[c.stage] },
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
        if (flumRef.current && z >= 9) {
          const key = cells.map((c) => c.join(",")).join("|"),
            planBounds = [
              Math.min(...cells.map((c) => c[0])),
              Math.min(...cells.map((c) => c[1])),
              Math.max(...cells.map((c) => c[2])),
              Math.max(...cells.map((c) => c[3])),
            ];
          let layer = flumCache.current.get(key);
          if (!layer) {
            const r = await fetch(
              "/api/maps/nearby?" +
                new URLSearchParams({
                  bbox: planBounds.join(","),
                  layer: "flum",
                }),
            );
            if (r.ok) {
              layer = await r.json();
              if (layer) flumCache.current.set(key, layer);
            }
          }
          if (layer && current === generation.current) {
            setFlum(layer);
            (m.getSource("law-flum") as GeoJSONSource).setData({
              ...layer.geojson,
              features: layer.geojson.features.map((f) => ({
                ...f,
                properties: {
                  ...f.properties,
                  color:
                    layer!.legend.find((l) => l.value === f.properties?.group)
                      ?.color ?? "#a1a1aa",
                },
              })),
            });
          }
        }
      } catch (e) {
        if (current === generation.current) setMessage((e as Error).message);
      } finally {
        if (current === generation.current) setLoading(false);
      }
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setLayoutProperty(
      "law-flum",
      "visibility",
      flumOn && zoom >= 9 ? "visible" : "none",
    );
    m.setPaintProperty("law-fill", "fill-opacity", flumOn ? 0 : 0.16);
    for (const id of ["law-boundaries", "law-area-labels"])
      m.setLayoutProperty(id, "visibility", boundariesOn ? "visible" : "none");
  }, [ready, flumOn, boundariesOn, zoom]);
  useEffect(() => {
    if (!place || !ready || !map.current) return;
    const m = map.current;
    let marker: import("maplibre-gl").Marker | undefined,
      cancelled = false;
    import("maplibre-gl").then((lib) => {
      if (destroyed.current || cancelled) return;
      marker = new lib.Marker({ color: "#0f766e" })
        .setLngLat(place.coordinates)
        .addTo(m);
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
  function choosePlace(p: Place) {
    setPlace(p);
    setAddress(p.label);
    setResults([]);
    setMessage("");
    const u = new URL(window.location.href);
    u.searchParams.set("lng", String(p.coordinates[0]));
    u.searchParams.set("lat", String(p.coordinates[1]));
    u.searchParams.set("q", p.label);
    u.searchParams.set("r", String(p.radius));
    window.history.replaceState(window.history.state, "", u);
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
        <Link href="/" className="law-map-brand">
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
        <div className="law-explorer-controls">
          <button aria-expanded={legend} onClick={() => setLegend(!legend)}>
            Legend
          </button>
          <button aria-expanded={layers} onClick={() => setLayers(!layers)}>
            Layers
          </button>
          <button aria-label="Use my location" onClick={locate}>
            ◎
          </button>
        </div>
        {legend && (
          <section className="law-map-legend" aria-label="Map legend">
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
                {flum?.legend.map((l) => (
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
          <section className="law-layer-panel" aria-label="Map layers">
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
                {zoom < 9
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
            <label>
              Find a project
              <select
                aria-label="Find a project"
                defaultValue=""
                onChange={(e) => {
                  const c = cases.find((c) => c.id === e.target.value);
                  if (c) {
                    openRef.current(c);
                    setMenu(false);
                  }
                }}
              >
                <option value="">Choose a visible project</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <h2>Areas we cover</h2>
            {areas.map((a) => (
              <Link key={a.id} href={a.href}>
                {a.name}, {a.stateAbbreviation}
              </Link>
            ))}
            <Link href="/us">Browse by state</Link>
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
              savedPlace && visiblePane.item.centroid
                ? {
                    distance: distance(
                      savedPlace.coordinates,
                      visiblePane.item.centroid,
                      { units: "miles" },
                    ),
                  }
                : undefined
            }
            onWatch={() => setDialog("watch")}
          />
        )}
        {!selected && (
          <div className="law-map-help">
            {zoom < 9
              ? "Choose an area to explore projects"
              : "Hover to preview · Click or tap for project details"}
          </div>
        )}
        {place && !selected && (
          <details className="law-nearby-projects">
            <summary>
              {nearby.length} projects within {place.radius} mile
              {place.radius === 1 ? "" : "s"}{" "}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setPlace(undefined);
                  setAddress("");
                  const u = new URL(window.location.href);
                  for (const k of ["lat", "lng", "q", "r"])
                    u.searchParams.delete(k);
                  window.history.replaceState(window.history.state, "", u);
                }}
              >
                Clear address
              </button>
            </summary>
            {nearby.map((c) => (
              <button key={c.id} onClick={() => openRef.current(c)}>
                {c.title}
                <small>
                  {c.miles.toFixed(1)} mi ·{" "}
                  {c.areaId ? areas.find((a) => a.id === c.areaId)?.name : ""}
                  {c.nextHearing ? " · " + c.nextHearing.label : ""}
                </small>
              </button>
            ))}
          </details>
        )}
        {loading && (
          <p className="law-map-loading" role="status">
            Loading projects…
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
          <Link href="/us">Areas we cover</Link>
          <Link href="/privacy">Privacy</Link>
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
            <InterestForm
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
            />
          </section>
        </div>
      )}
    </main>
  );
}
