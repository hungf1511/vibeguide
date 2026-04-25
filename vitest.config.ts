import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      // P0 exit criteria: keep coverage gate meaningful for the self-dogfood suite.
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/mcp/server.ts"],
    },
  },
});
