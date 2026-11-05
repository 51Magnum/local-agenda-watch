import {revalidatePath,revalidateTag} from "next/cache";
import {requireOnboardingMutation} from "../runtime-environment";
import {visibleAreas} from "../areas/registry";
import {saveMapSnapshot} from "../maps/store";
import {jurisdiction} from "./registry";
import {readPublished} from "./self-check-store";
import {stagedMapSnapshot} from "./resident-records";

/** Keep routes, map data and cached coverage in sync with the durable publication. */
export async function refreshPublicationProjection(areaId:string){
 requireOnboardingMutation();const d=jurisdiction(areaId);if(!d)throw Error("Unknown jurisdiction");
 await visibleAreas();const published=await readPublished(areaId);
 if(published)await saveMapSnapshot(stagedMapSnapshot(d,published));
 revalidateTag("map-area:"+areaId,{expire:0});revalidateTag("map-case-index-v1",{expire:0});
 const base="/"+d.area.country+"/"+d.state+"/"+areaId;
 revalidatePath(base,"layout");revalidatePath("/");revalidatePath("/sitemap.xml");revalidatePath("/api/map/meta");revalidatePath("/api/map/boundaries");
}
