import { mkdir, copyFile } from "node:fs/promises";
// Serve the module worker explicitly: Turbopack does not emit MapLibre's relative worker URL.
await mkdir("public/maplibre", { recursive: true });
await copyFile("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/worker.mjs");
await copyFile("node_modules/maplibre-gl/LICENSE.txt", "public/maplibre/LICENSE.txt");

const {spawnSync}=await import("node:child_process");
const result=spawnSync(process.execPath,["node_modules/tsx/dist/cli.mjs","scripts/prepare-boundaries.ts"],{stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);
