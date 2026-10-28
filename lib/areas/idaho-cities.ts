/** Legacy import retained; definitions are owned by the jurisdiction registry. */
import {AREAS} from "./registry";
import {MUNICIPAL_IDS} from "../sources/municipal-config";
export const IDAHO_CITIES=Object.fromEntries(MUNICIPAL_IDS.map(id=>[id,AREAS[id]]));
