import { refreshConfiguredMaps } from "../lib/maps/refresh";
refreshConfiguredMaps(Date.now() + 120000).then((results) => { console.log(JSON.stringify(results, null, 2)); if (results.some((r) => r.unavailable)) process.exitCode = 1; }).catch(() => { console.error("Map refresh failed"); process.exitCode = 1; });
