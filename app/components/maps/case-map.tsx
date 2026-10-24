"use client";
import {placeProjectCard} from "@/lib/maps/popup-position";
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
import {liveAreaAtPoint,locationMapUrl} from "@/lib/areas/coverage";
import {commonStageLabel} from "@/lib/maps/radius";
import InterestForm from "@/app/components/locations/interest-form";
import {areaPath,getArea,mapStageLabel} from "@/lib/areas/registry";
import MapImageViewer from "./map-image-viewer";

import { popupContent, popupDisposers } from "./popup-card";
const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
function caseFeatures(cases: MapCase[]): FeatureCollection {
  return { type: "FeatureCollection", features: cases.filter((c) => c.geometry && !c.citywide).map((c) => ({ type: "Feature", geometry: c.geometry!, properties: { id: c.id, color: c.statusNote ? "#64748b" : STAGE_COLORS[c.stage], approximate: c.confidence === "approximate" } })) };
}
export default function CaseMap({ jurisdiction, caseIds, compact = false, fullPage = false, matchHeightTo, showNearbyList = false, combined }: { combined?:{country:string;state:string}; jurisdiction: string; caseIds?: readonly string[]; compact?: boolean; fullPage?: boolean; matchHeightTo?: string; showNearbyList?: boolean }) {
  const area = getArea(jurisdiction);
  const [expandedImage, setExpandedImage] = useState<MapVisual>();
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const [data, setData] = useState<PublicMapData>(); const [error, setError] = useState("");
  const [hiddenStages, setHiddenStages] = useState<string[]>([]);
  const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);
  const [withinMile, setWithinMile] = useState(Boolean(combined));
  const [searchRestored,setSearchRestored]=useState(!combined);
  const [viewport,setViewport]=useState<string>();
  const [radius,setRadius]=useState(1),[hiddenAreas,setHiddenAreas]=useState<string[]>([]);
  const [placingPin, setPlacingPin] = useState(false);
  const pinMode = useRef(false);
  const applyMapPin = useRef<((coordinates: [number, number]) => void) | null>(null);
  const searchGeneration = useRef(0);
  const flumRequestKey=useRef("");
  const [loadedFlumKey,setLoadedFlumKey]=useState("");
  const [flumOn, setFlumOn] = useState(false); const [flum, setFlum] = useState<FlumCache>();
  const [address, setAddress] = useState(""); const [searching, setSearching] = useState(false); const [searchMessage, setSearchMessage] = useState(""); const [results, setResults] = useState<AddressResult[]>([]); const [location, setLocation] = useState<AddressResult>();
  useEffect(()=>{if(!combined||!location)return;const selected=liveAreaAtPoint(location.coordinates);if(selected)try{localStorage.setItem("law:last-area",selected.id);}catch{}},[combined,location]);
  const openProject = useRef<((id: string) => void) | null>(null);
  const container = useRef<HTMLDivElement>(null); const map = useRef<LibreMap | null>(null); const popup = useRef<Popup | null>(null); const [ready, setReady] = useState(false);
  const idsKey = caseIds?.join(",") ?? "";
  const longitude=location?.coordinates[0]??area?.center[0]??0,latitude=location?.coordinates[1]??area?.center[1]??0;
  const radiusQuery=new URLSearchParams({lng:String(longitude),lat:String(latitude),r:String(radius),country:combined?.country??"",state:combined?.state??""}).toString();
  const coverageQuery=new URLSearchParams({overview:"1",country:combined?.country??"",state:combined?.state??""}).toString();
  const combinedKey=combined?(location?radiusQuery:coverageQuery):"";
  const flumLoading=flumOn&&(combined?Boolean(viewport&&loadedFlumKey!==viewport):!flum);
  const displayStage=(stage:string)=>combined?commonStageLabel(stage):mapStageLabel(stage,area);
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
    if(combined&&!searchRestored)return;
    const abort = new AbortController();
    fetch(combinedKey?"/api/maps/nearby?"+combinedKey:"/api/maps/" + encodeURIComponent(jurisdiction)+(idsKey?"?cases="+encodeURIComponent(idsKey):""), { signal: abort.signal, cache: "no-cache" }).then(async (r) => { if (!r.ok) throw new Error("Map data is temporarily unavailable."); setData(await r.json());setError(""); }).catch((e) => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [jurisdiction,idsKey,combinedKey,searchRestored,combined]);
  useEffect(() => {
    if (compact) return;
    try { if(!combined&&getArea(jurisdiction)?.status==="live")localStorage.setItem("law:last-area",jurisdiction); } catch {}
    const restore = () => { setSearchRestored(true);const query=new URLSearchParams(window.location.search); setFlumOn(query.get("flum")==="1"); const shared = readSharedSearch(window.location.hash) ?? readSharedSearch("#"+query); if (shared) { if(!combined){const destination=locationMapUrl(shared.coordinates,shared.label);if(destination){window.location.replace(destination+(shared.source==="map"?"&pin=1":"")+(query.get("flum")==="1"?"&flum=1":""));return;}} if(!window.location.hash&&!query.get("q")&&!query.get("address"))shared.source="map"; setLocation(shared); setAddress(shared.source === "map" ? "" : shared.label); setWithinMile(Boolean(combined)||(window.location.hash?new URLSearchParams(window.location.hash.slice(1)):query).get("nearby") === "1"); const r=Number(query.get("r")??1);if(combined&&Number.isFinite(r)&&r>=.25&&r<=10)setRadius(r); } };
    restore(); window.addEventListener("hashchange", restore); return () => window.removeEventListener("hashchange", restore);
  }, [compact,jurisdiction,combined]);
  useEffect(() => {
    applyMapPin.current = (coordinates) => {
      const pin = createMapPin(coordinates);
      if(!combined&&!compact){const destination=locationMapUrl(coordinates,pin.label);if(destination){window.location.assign(destination+"&pin=1");return;}}
      searchGeneration.current += 1;
      if(combined)setWithinMile(true);
      setSearching(false); setLocation(pin); setAddress(""); setResults([]); setSearchMessage("");
      pinMode.current = false; setPlacingPin(false);
      if (map.current) map.current.getCanvas().style.cursor = "";
      popup.current?.remove();
      window.history.replaceState(null, "", locationUrl(pin,Boolean(combined)||withinMile));
    };
  });
  function togglePinMode() {
    const active = !pinMode.current; pinMode.current = active; setPlacingPin(active);
    popup.current?.remove(); setResults([]); setSearchMessage("");
    if (map.current) map.current.getCanvas().style.cursor = active ? "crosshair" : "";
  }
  const filtered = useMemo(() => data?.cases.filter((c) => (!idsKey || idsKey.split(",").includes(c.id)) && !hiddenStages.includes(c.stage) && !hiddenTypes.includes(c.type) && (!combined || c.members?.some(m=>!hiddenAreas.includes(m.areaId)))) ?? [], [data, idsKey, hiddenStages, hiddenTypes,hiddenAreas,combined]);
  const cases = useMemo(() => withinMile && location ? nearbyCases(filtered, location.coordinates,radius) : filtered, [filtered, withinMile, location,radius]);
  const mapped = cases.filter((c) => c.geometry && !c.citywide);
  useEffect(() => {
    if (!data || !container.current) return;
    let disposed = false, pinned = false, hovered = "";
    let popupProject: MapCase | undefined, reframing=false;
    let previousMapMinHeight:string|undefined;
    let hoverOrigin: ScreenPoint | null = null, previousPointer: ScreenPoint | null = null;
    let instance: LibreMap | undefined; let observer: ResizeObserver | undefined;let viewportTimer:ReturnType<typeof setTimeout>|undefined;
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
        element.style.width=Math.min(640,viewport.clientWidth-32)+"px";
        if (!popupProject?.geometry) return;
        const bounds=bbox(popupProject.geometry),nw=instance.project([bounds[0],bounds[3]]),se=instance.project([bounds[2],bounds[1]]);
        const content=element.querySelector<HTMLElement>(".law-project-popup");
        let placement=placeProjectCard({width:viewport.clientWidth,height:viewport.clientHeight},{left:nw.x,right:se.x,top:nw.y,bottom:se.y},{width:Math.min(640,viewport.clientWidth-32),height:(content?.scrollHeight??300)});
        element.style.width=placement.width+"px";
        element.style.minWidth="0";
        // Re-measure if the reserved width switches the card to a vertical stack.
        const actualHeight=content?.getBoundingClientRect().height??placement.height;
        if(actualHeight>viewport.clientHeight-32){previousMapMinHeight??=viewport.style.minHeight;viewport.style.minHeight=Math.ceil(actualHeight+32)+"px";}
        if(Math.abs(actualHeight-placement.height)>2){placement=placeProjectCard({width:viewport.clientWidth,height:viewport.clientHeight},{left:nw.x,right:se.x,top:nw.y,bottom:se.y},{width:placement.width,height:actualHeight});element.style.width=placement.width+"px";}
        element.style.setProperty("--law-popup-content-height",Math.max(100,placement.height-36)+"px");
        const point=instance.project(popup.current.getLngLat());
        popup.current.setOffset([placement.x+placement.width/2-point.x,placement.y+placement.height/2-point.y]);
        if(placement.reframe&&!reframing){
          reframing=true;
          const padding={top:40,bottom:40,left:40,right:40};
          if(placement.side==="left"||placement.side==="right")padding[placement.side]=placement.width+52;
          else padding[placement.side]=Math.min(placement.height+32,viewport.clientHeight-90);
          instance.fitBounds([[bounds[0],bounds[1]],[bounds[2],bounds[3]]],{padding,maxZoom:instance.getZoom(),duration:0});
          reframing=false;
        }
      }
      function show(content: HTMLElement, coordinates: [number, number], projectCard = false) {
        const selectedProject=popupProject;
        popup.current?.remove(); popupProject=selectedProject;
        const next = new lib.Popup({ closeButton: true, closeOnClick: false, maxWidth: projectCard ? "none" : "300px", className: projectCard ? "law-case-popup" : "", anchor: projectCard ? "center" : undefined, offset: projectCard ? 0 : 12, focusAfterOpen: pinned }).setLngLat(coordinates).setDOMContent(content).addTo(instance!);
        popup.current = next;
        sizePopup();
        content.querySelectorAll("img").forEach(image => {image.addEventListener("load", sizePopup, {once:true});image.addEventListener("error",sizePopup,{once:true});});
        next.getElement().addEventListener("mouseleave", closeHover);
        next.on("close", () => { popupDisposers.get(content)?.(); popupDisposers.delete(content); if (popup.current === next) { if(previousMapMinHeight!==undefined){instance!.getContainer().style.minHeight=previousMapMinHeight;previousMapMinHeight=undefined;} popupProject=undefined; popup.current = null; hovered = ""; pinned = false; } });
      }
      function showProject(item: MapCase) {
        if (!item.geometry || !data) return;
        popupProject=item;
        show(popupContent(item, setExpandedImage, data.jurisdiction.id, data.cases), item.centroid ?? geometryCentroid(item.geometry), true);
      }
      openProject.current = (id) => {
        const item = data.cases.find((c) => c.id === id); if (!item?.geometry || !instance) return;
        const b = bbox(item.geometry);
        popup.current?.remove(); pinned = true;
        instance.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 70, maxZoom: 15 });
        showProject(item); hovered = id;
      };
      const updateViewport=()=>{if(!combined||!instance)return;if(viewportTimer)clearTimeout(viewportTimer);viewportTimer=setTimeout(()=>{if(disposed||!instance)return;const b=instance.getBounds(),span=Math.max(b.getEast()-b.getWest(),b.getNorth()-b.getSouth()),step=2**Math.floor(Math.log2(span/8));const bounds=[Math.floor(b.getWest()/step)*step,Math.floor(b.getSouth()/step)*step,Math.ceil(b.getEast()/step)*step,Math.ceil(b.getNorth()/step)*step];setViewport(bounds.map(v=>Number(v.toFixed(6))).join(","));},200);};
      instance.on("moveend",updateViewport);
      instance.on("load", () => {
        if (!instance) return;
        instance.addSource("flum", { type: "geojson", data: empty }); instance.addLayer({ id: "flum-fill", type: "fill", source: "flum", paint: { "fill-color": "#94a3b8", "fill-opacity": 0.35 } });
        instance.addSource("boundaries",{type:"geojson",data:data.boundaries??empty});instance.addLayer({id:"city-limits",type:"line",source:"boundaries",paint:{"line-color":"#475569","line-width":1.5,"line-opacity":.5,"line-dasharray":[4,3]}});
        instance.addSource("cases", { type: "geojson", data: empty });
        instance.addLayer({ id: "case-fill", type: "fill", source: "cases", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.2 } });
        instance.addLayer({ id: "case-halo", type: "line", source: "cases", filter: ["==", ["get", "approximate"], false], paint: { "line-color": "#ffffff", "line-width": 7 } });
        instance.addLayer({ id: "case-approx-halo", type: "line", source: "cases", filter: ["==", ["get", "approximate"], true], paint: { "line-color": "#ffffff", "line-width": 7, "line-dasharray": [8 / 7, 8 / 7] } });
        instance.addLayer({ id: "case-line", type: "line", source: "cases", filter: ["==", ["get", "approximate"], false], paint: { "line-color": ["get", "color"], "line-width": 4 } });
        instance.addLayer({ id: "case-approx", type: "line", source: "cases", filter: ["==", ["get", "approximate"], true], paint: { "line-color": ["get", "color"], "line-width": 4, "line-dasharray": [2, 2] } });
        instance.addSource("search", { type: "geojson", data: empty });
        instance.addLayer({ id: "search-ring", type: "line", source: "search", filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": "#0f766e", "line-width": 2, "line-dasharray": [3, 2] } });
        instance.addLayer({ id: "search-pin", type: "circle", source: "search", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 8, "circle-color": "#0f766e", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
        if(data.overview)instance.fitBounds([[data.jurisdiction.bounds[0],data.jurisdiction.bounds[1]],[data.jurisdiction.bounds[2],data.jurisdiction.bounds[3]]],{padding:35,maxZoom:11,duration:0});
        updateViewport();setReady(true);
      });
      instance.on("mousemove", (event) => {
        if (!instance?.getLayer("case-fill")) return;
        if (pinMode.current) { instance.getCanvas().style.cursor = "crosshair"; return; }
        const hit = instance.queryRenderedFeatures(event.point, { layers: ["case-fill", "case-line", "case-approx", "case-halo", "case-approx-halo"] })[0];
        instance.getCanvas().style.cursor = hit ? "pointer" : "";
        if (compact || pinned) return;
        const pointer = { x: event.originalEvent.clientX, y: event.originalEvent.clientY };
        // Keep the selected card reachable even when another outline lies in
        // the pointer corridor between this project and its card.
        const activeCard=popup.current?.getElement();
        if(hit&&String(hit.properties.id)!==hovered&&activeCard&&hoverOrigin&&previousPointer&&movingToPopup(hoverOrigin,previousPointer,pointer,activeCard.getBoundingClientRect())){previousPointer=pointer;return;}
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
          if (land) { const content = document.createElement("div"); content.className = "law-project-popup"; const title = document.createElement("strong"); title.textContent = String(land.properties.category ?? land.properties[data.flum.categoryField] ?? "Unknown"); const label = document.createElement("p"); label.textContent = land.properties.jurisdiction ? String(land.properties.jurisdiction)+" · Future land use" : "Future land use"; content.append(title, label); show(content, [event.lngLat.lng, event.lngLat.lat]); }
          else pinned = false;
        }
      });
      instance.getCanvas().addEventListener("keydown", (event) => { if (event.key === "Escape") popup.current?.remove(); });
      instance.on("move", sizePopup);
      observer = new ResizeObserver(() => { instance?.resize(); sizePopup(); }); observer.observe(container.current);
    }).catch(() => setError("The map could not load. Browse cases from the city page."));
    return () => { disposed = true;if(viewportTimer)clearTimeout(viewportTimer); observer?.disconnect(); popup.current?.remove(); openProject.current = null; instance?.remove(); map.current = null; setReady(false); };
  }, [data, compact,combined]);
  useEffect(() => {
    if (!ready || !map.current) return;
    popup.current?.remove(); (map.current.getSource("cases") as GeoJSONSource)?.setData(caseFeatures(cases));
    if (compact && cases.some((c) => c.geometry)) { const b = bbox(caseFeatures(cases)); map.current.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 35, maxZoom: 15, duration: 0 }); }
  }, [ready, cases, compact]);
  useEffect(() => {
    if (!ready || !map.current || compact || !data) return;
    const id = new URLSearchParams(window.location.search).get("case");
    const item = data.cases.find(c => c.id === id);
    if (!item?.geometry) return;
    const bounds = bbox(caseFeatures([item]));
    map.current.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 65, maxZoom: 15, duration: 0 });
  }, [ready, compact, data]);
  useEffect(() => {
    if (!flumOn || !data || (combined?!viewport:Boolean(flum))) return;
    const key=combined?viewport!:jurisdiction;if(flumRequestKey.current===key&&flum)return;
    const abort = new AbortController();
    fetch(combined?"/api/maps/nearby?"+new URLSearchParams({bbox:viewport!,layer:"flum",country:combined.country,state:combined.state}):"/api/maps/" + encodeURIComponent(jurisdiction) + "?layer=flum", { signal: abort.signal }).then(async (r) => { if (!r.ok) throw new Error(); const layer=await r.json();if(!abort.signal.aborted){flumRequestKey.current=key;setLoadedFlumKey(key);setFlum(layer);} }).catch(() => { if (!abort.signal.aborted){setLoadedFlumKey(key);setSearchMessage("Future land use is temporarily unavailable.");} });
    return () => abort.abort();
  }, [flumOn, flum, jurisdiction,viewport,data,combined]);
  useEffect(() => {
    if (!ready || !map.current || !data) return;
    // Keep the transparent fill layer for hit testing across the whole project.
    map.current.setPaintProperty("case-fill", "fill-opacity", flumOn ? 0 : 0.2);
    (map.current.getSource("flum") as GeoJSONSource)?.setData(flumOn && flum ? flum.geojson : empty);
    const legend=flum?.legend??data.flum.legend;
    if (legend.length) map.current.setPaintProperty("flum-fill", "fill-color", ["match", ["get", data.flum.categoryField], legend[0].value, legend[0].color, ...legend.slice(1).flatMap((c) => [c.value, c.color]), "#94a3b8"] as ExpressionSpecification);
  }, [ready, flumOn, flum, data,combined]);
  useEffect(() => {
    if (!ready || !map.current) return;
    popup.current?.remove();
    const ring = location ? circle(location.coordinates, radius, { units: "miles", steps: 80 }) : undefined;
    (map.current.getSource("search") as GeoJSONSource)?.setData(location && ring ? { type: "FeatureCollection", features: [...(withinMile ? [ring] : []), { type: "Feature", geometry: { type: "Point", coordinates: location.coordinates }, properties: {} }] } : empty);
  }, [ready, location, withinMile,radius]);
  useEffect(() => {
    if (!ready || !map.current || !location) return;
    const b = bbox(circle(location.coordinates, radius, { units: "miles", steps: 80 })); map.current.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 45 });
  }, [ready, location,radius]);
  function mapBaseUrl(){const q=new URLSearchParams(window.location.search);for(const key of ["lat","lng","r","nearby","pin","address","q"])q.delete(key);return window.location.pathname+(q.size?"?"+q:"");}
  function locationUrl(result: AddressResult, nearby = withinMile) { if(combined){const url=new URL(mapBaseUrl(),window.location.origin);url.searchParams.set("lat",result.coordinates[1].toFixed(6));url.searchParams.set("lng",result.coordinates[0].toFixed(6));url.searchParams.set("r",String(radius));url.searchParams.set("q",result.label);if(result.source==="map")url.searchParams.set("pin","1");return url.pathname+url.search;} return mapBaseUrl() + searchHash(result) + (nearby ? "&nearby=1" : ""); }
  function choose(result: AddressResult) { if(!combined&&!compact){const destination=locationMapUrl(result.coordinates,result.label);if(destination){window.location.assign(destination);return;}} if(combined)setWithinMile(true);setLocation(result); setResults([]); setSearchMessage(""); window.history.replaceState(null, "", locationUrl(result)); }
  function toggleNearby(checked: boolean) {
    setWithinMile(checked);
    if (!location) return;
    window.history.replaceState(null, "", locationUrl(location, checked));
    if (checked && map.current) {
      const b = bbox(circle(location.coordinates, radius, { units: "miles", steps: 80 }));
      map.current.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 45 });
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!data || address.trim().length < 3) return;
    const generation = ++searchGeneration.current;
    if (pinMode.current) togglePinMode();
    setSearching(true); setSearchMessage("");
    try { const matches = combined?await (async()=>{const key="law:combined-search:"+address.trim().toUpperCase();try{const cached=JSON.parse(sessionStorage.getItem(key)??"null");if(cached?.expires>Date.now())return cached.results as AddressResult[];}catch{}const r=await fetch("/api/locations/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:address.trim(),country:combined.country})});const j=await r.json();if(!r.ok)throw new Error();const results=(j.results??[]).map((m:AddressResult)=>({...m,source:m.source??"Census"}));try{sessionStorage.setItem(key,JSON.stringify({expires:Date.now()+86400000,results}));}catch{}return results;})():await searchAddress(data.jurisdiction, address.trim()); if (generation !== searchGeneration.current) return; setResults(matches); if (matches.length === 1) choose(matches[0]); else setSearchMessage(matches.length ? "Choose an address." : "No address found. Try adding the city."); }
    catch { if (generation === searchGeneration.current) setSearchMessage("Address search is temporarily unavailable."); } finally { if (generation === searchGeneration.current) setSearching(false); }
  }
  async function share() { try { const path = location ? locationUrl(location) : window.location.pathname + window.location.search; await navigator.clipboard.writeText(window.location.origin + path); setSearchMessage(""); setLinkCopied(true); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setLinkCopied(false), 2000); } catch { setSearchMessage("Copy this page’s URL to share."); } }
  function clearLocation() { searchGeneration.current += 1; setSearching(false); if (pinMode.current) togglePinMode(); setLocation(undefined); setAddress(""); setWithinMile(false);if(combined)setRadius(1); setSearchMessage(""); window.history.replaceState(null, "", mapBaseUrl()); }
  const mapInfo = data && (<details className={compact ? "law-map-stage-key law-project-map-key" : "law-map-info"}><summary>Map key & sources</summary><div className="law-map-info-content">
          {compact && <div className="law-map-legend" aria-label="Case stage legend">{MAP_STAGES.map((s) => <span key={s}><i style={{ background: STAGE_COLORS[s] }}/>{displayStage(s)}</span>)}<span>┄ Approximate boundary</span></div>}
          {flumOn && !combined && <div className="law-map-legend" aria-label="Future land use legend">{(flum?.legend??data.flum.legend).map((c) => <span key={c.value}><i style={{ background: c.color }}/>{c.label}</span>)}</div>}
          {data.flum.layerUrl && <p><span>{data.flum.label}</span>{data.flum.adoptedDate && <> · <a href={data.flum.adoptionSource}>Adopted {data.flum.adoptedDate}</a></>}. Future land use is separate from zoning. {data.flum.dataNote}</p>}
          <p>Updated {new Intl.DateTimeFormat("en-US", { timeZone: area?.timezone ?? "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updatedAt))} ({area?.timezone ?? "UTC"}).</p>{data.warnings.map((w) => <p key={w}>{w}</p>)}
          {!compact && <label>Find a project <select aria-label="Find a project" defaultValue="" onChange={(e) => openProject.current?.(e.target.value)}><option value="">Choose a project</option>{mapped.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
        </div></details>);
  return <section id={compact ? "case-location-map" : "case-map"} className={"law-map" + (compact ? " law-map-compact" : "") + (fullPage ? " law-map-full" : "") + (matchHeightTo ? " law-map-match-card" : "")} aria-label="Development map" onKeyDown={(e) => { if (e.key === "Escape" && pinMode.current) { e.preventDefault(); togglePinMode(); } }}>
    {!fullPage && <div className="law-map-heading"><h2>{compact ? "Project map" : "Development map"}</h2>{!compact && <a href={areaPath(jurisdiction)+"/map"}>Open map →</a>}</div>}
    {error && <p role="status">{error}</p>}{!data && !error && <p role="status">Loading map…</p>}
    {data && <>
      <div className="law-map-toolbar">
        {!compact && <form className="law-search" onSubmit={submit} aria-busy={searching}><label className="sr-only" htmlFor={"map-address-" + jurisdiction}>Find an address in {data.jurisdiction.name}</label><input id={"map-address-" + jurisdiction} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={location?.source === "map" ? location.label : "Search an address"} maxLength={200} minLength={3} required autoComplete="street-address"/><button disabled={searching} type="submit">{searching && <span className="law-search-spinner" aria-hidden="true"/>}{searching ? "Searching..." : "Search"}</button><button type="button" className="law-pin-control" disabled={!ready && location?.source !== "map"} aria-pressed={location?.source === "map" && !placingPin ? undefined : placingPin} onClick={location?.source === "map" && !placingPin ? clearLocation : togglePinMode}>{placingPin ? "Cancel pin" : location?.source === "map" ? "Clear pin" : "Drop pin"}</button><button type="button" onClick={share}>Copy link</button>{location && location.source !== "map" && <button type="button" onClick={clearLocation} title="Remove the address and one-mile filter">Clear address</button>}</form>}
        <div className="law-map-toggles">
          {combined&&<label>Radius <select aria-label="Search radius" value={radius} onChange={e=>{const miles=Number(e.target.value);setRadius(miles);const url=new URL(window.location.href);url.searchParams.set("r",String(miles));window.history.replaceState(null,"",url.pathname+url.search);}}>{[.25,.5,1,2,3,5,10].map(r=><option key={r} value={r}>{r} mi</option>)}</select></label>}
          {!compact && !combined && <label title={location ? "Show only projects within one mile of your selected location" : "Search an address or drop a pin first"}><input type="checkbox" checked={withinMile} disabled={!location} onChange={(e) => toggleNearby(e.target.checked)}/> Within 1 mile</label>}
          {data.flum.layerUrl && <label><input type="checkbox" checked={flumOn} onChange={(e) => { setFlumOn(e.target.checked); const url=new URL(window.location.href); if(e.target.checked)url.searchParams.set("flum","1");else url.searchParams.delete("flum");window.history.replaceState(null,"",url.pathname+url.search+url.hash); }}/> Future land use</label>}
          {!compact && <details className="law-filter-menu" onPointerEnter={(e) => { if (e.pointerType === "mouse") e.currentTarget.open = true; }} onPointerLeave={(e) => { if (e.pointerType === "mouse") e.currentTarget.open = false; }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }} onKeyDown={(e) => { if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus(); } }}><summary className="law-filter-button"><span aria-hidden="true">☷</span> Filters{hiddenStages.length + hiddenTypes.length > 0 ? " •" : ""}</summary><div>
            <div className="law-filter-groups">
              <fieldset><legend>Stage</legend>
                <label className="law-filter-all"><input type="checkbox" checked={hiddenStages.length === 0} onChange={(e) => setHiddenStages(e.target.checked ? [] : [...MAP_STAGES])}/> All stages</label>
                {MAP_STAGES.map((stage) => <label key={stage}><input type="checkbox" checked={!hiddenStages.includes(stage)} onChange={(e) => setHiddenStages((current) => e.target.checked ? current.filter((s) => s !== stage) : [...current, stage])}/><i className="law-stage-swatch" style={{ background: STAGE_COLORS[stage] }}/>{displayStage(stage)}</label>)}
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
      <div className="law-map-surface"><div ref={container} className="law-map-canvas" role="region" aria-label={compact ? "Interactive project map. Click or tap an outline for details." : "Interactive project map. Hover or tap an outline for details."}/><span className="law-map-hint" role={placingPin ? "status" : undefined}>{placingPin ? "Click map to place pin · Esc to cancel" : flumLoading ? "Loading future land use…" : compact ? "Click a boundary for details" : "Hover or tap a project"}</span>{!compact && <details className="law-map-stage-key" open><summary>Stages</summary><div className="law-map-legend" aria-label="Case stage legend">{MAP_STAGES.map((s) => <span key={s}><i style={{ background: STAGE_COLORS[s] }}/>{displayStage(s)}</span>)}<span>┄ Approximate boundary{combined?" · Dashed gray: city limits":""}</span>{combined&&flumOn&&(flum?.legend??[]).map(c=><span key={c.value}><i style={{background:c.color}}/>{c.label}</span>)}</div></details>}{compact && mapInfo}</div>
      {!compact && <div className="law-map-bottom"><span>{mapped.length} projects shown</span>{!fullPage && <a href={areaPath(jurisdiction)+"#all-cases"} onClick={() => { const list = document.getElementById("all-cases"); if (list instanceof HTMLDetailsElement) list.open = true; }}>All cases</a>}
        {mapInfo}
      </div>}
      {compact && data.flum.layerUrl && <p className="law-map-source"><strong>Future land use:</strong> {[...new Set(cases.flatMap((c) => c.flumCategories))].join("; ") || "Not yet available"}</p>}
      {!compact && !withinMile && data.cases.some(c=>!c.geometry&&!c.citywide) && <details open={!data.cases.some(c=>c.geometry)?true:undefined} className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-800"><summary className="cursor-pointer">Projects without a verified map boundary ({data.cases.filter(c=>!c.geometry&&!c.citywide).length})</summary><ul className="mt-3 space-y-2">{data.cases.filter(c=>!c.geometry&&!c.citywide).map(c=><li key={c.id}><a href={c.href} className="underline">{c.title}</a></li>)}</ul></details>}
      {!compact && data.cases.some(c=>c.citywide) && <details className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-800"><summary className="cursor-pointer">Citywide changes ({data.cases.filter(c=>c.citywide).length})</summary><ul className="mt-3 space-y-2">{data.cases.filter(c=>c.citywide).map(c=><li key={c.id}><a href={c.href} className="underline">{c.title}</a></li>)}</ul></details>}
      {withinMile && !mapped.length && <p role="status">No mapped projects within the selected radius match your filters. Projects without a verified boundary cannot be measured.</p>}
    </>}
    {showNearbyList&&withinMile&&location&&<section aria-label="Nearby projects" className="rounded-xl border border-zinc-300 p-5 dark:border-zinc-800"><h2 className="font-semibold">Within {radius} {radius===1?"mile":"miles"} · all nearby jurisdictions</h2>{combined&&<div className="law-jurisdiction-chips" aria-label="Filter jurisdictions">{data?.areas?.map(a=><button type="button" key={a.id} aria-pressed={!hiddenAreas.includes(a.id)} onClick={()=>setHiddenAreas(current=>current.includes(a.id)?current.filter(id=>id!==a.id):[...current,a.id])}>{a.name}</button>)}</div>}<ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">{nearbyCases(filtered,location.coordinates,radius).map(c=><li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><button className="text-left font-medium underline underline-offset-4" onClick={()=>{container.current?.scrollIntoView({behavior:"smooth",block:"center"});openProject.current?.(c.id);}}>{c.title}</button>{combined&&<p className="mt-1 text-xs text-zinc-500">{[...new Set(c.members?.map(m=>getArea(m.areaId)?.name))].join(" · ")} · {c.caseIds?.join(", ")}</p>}</div><span>{c.distance.toFixed(1)} mi{c.nextHearing?" · "+c.nextHearing.label:""}</span></li>)}</ul></section>}
    {combined&&location&&<section className="rounded-xl bg-zinc-100 p-5 dark:bg-zinc-900"><h2 className="font-semibold">Follow this place</h2><p className="mt-2 text-sm text-zinc-500">Includes every tracked jurisdiction within {radius} {radius===1?"mile":"miles"}. Email alerts are coming soon.</p><InterestForm key={location.coordinates.join(",")+radius} kind="follow" areaName={location.label} coordinates={location.coordinates} radiusMiles={radius} place/></section>}
    {linkCopied && <div className="law-copy-toast" role="status"><span aria-hidden="true">✓</span> Link copied</div>}
    {expandedImage && <MapImageViewer visual={expandedImage} onClose={() => setExpandedImage(undefined)} />}
  </section>;
}
