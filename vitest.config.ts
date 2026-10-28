import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    environment: "node",
    env: {VERCEL_ENV:"production"},
  },
});
