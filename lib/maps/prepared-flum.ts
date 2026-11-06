import "server-only";
import type {FlumCache} from "./types";
import source0 from "../../data/flum/ada-county.json";
import source1 from "../../data/flum/boise.json";
const snapshots:Record<string,FlumCache>={"ada-county":source0 as FlumCache,"boise":source1 as FlumCache};
export function preparedFlumSnapshot(id:string):FlumCache|undefined{return snapshots[id]?structuredClone(snapshots[id]):undefined;}
