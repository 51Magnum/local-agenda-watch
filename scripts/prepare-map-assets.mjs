import { mkdir, copyFile } from "node:fs/promises";
// Serve the module worker explicitly: Turbopack does not emit MapLibre's relative worker URL.
await mkdir("public/maplibre", { recursive: true });
await copyFile("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/worker.mjs");
await copyFile("node_modules/maplibre-gl/LICENSE.txt", "public/maplibre/LICENSE.txt");
