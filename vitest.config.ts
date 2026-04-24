import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Threshold intentionally low for Phase 0; raise to 70% as test suite grows
      thresholds: {
        lines: 10,
        functions: 10,
        branches: 5,
        statements: 10,
      },
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/mcp/server.ts"],
    },
  },
});
