import type {Map as LibreMap,RasterSourceSpecification,LayerSpecification} from "maplibre-gl";
import {basemapChoice,subscribeBasemap} from "./basemap-choice";
export const SATELLITE_SOURCE = "law-usgs-imagery", SATELLITE_LAYER = "law-satellite-basemap";
export const USGS_IMAGERY:RasterSourceSpecification={type:"raster",tiles:["https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"],tileSize:256,maxzoom:16,attribution:"USGS The National Map"};
const installed=new WeakMap<LibreMap,()=>void>();

/** Install before application layers. Never replace the style or recreate sources. */
export function installBasemap(map:LibreMap) {
  const existing=installed.get(map);if(existing)return existing;
  let baseLayers=new Map<string,NonNullable<LayerSpecification["layout"]>["visibility"]>();
  function apply(){
    if(!map.getLayer(SATELLITE_LAYER))return;
    const satellite=basemapChoice()==="satellite";
    for(const [id,visibility] of baseLayers)if(map.getLayer(id))map.setLayoutProperty(id,"visibility",satellite?"none":visibility);
    map.setLayoutProperty(SATELLITE_LAYER,"visibility",satellite?"visible":"none");
  }
  function initialize(){
    if(!map.getSource(SATELLITE_SOURCE)){
      const layers=map.getStyle().layers;
      // Keep OpenFreeMap road/place symbols. Only original basemap artwork is hidden.
      baseLayers=new Map(layers.filter(layer=>layer.type!=="symbol").map(layer=>[layer.id,layer.layout?.visibility??"visible"]));
      map.addSource(SATELLITE_SOURCE,USGS_IMAGERY);
      map.addLayer({id:SATELLITE_LAYER,type:"raster",source:SATELLITE_SOURCE,layout:{visibility:"none"},paint:{"raster-fade-duration":0}},layers.find(layer=>layer.type==="symbol")?.id);
    }
    apply();
  }
  const unsubscribe=subscribeBasemap(apply);
  const dispose=()=>{unsubscribe();map.off("style.load",initialize);map.off("remove",dispose);installed.delete(map);};
  installed.set(map,dispose);map.on("style.load",initialize);map.on("remove",dispose);
  if(map.isStyleLoaded())initialize();
  return dispose;
}
