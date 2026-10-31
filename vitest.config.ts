import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {"server-only": new URL("./lib/testing/server-only.ts",import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/,"$1")},
  },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    environment: "node",
    env: {VERCEL_ENV:"production"},
  },
});
