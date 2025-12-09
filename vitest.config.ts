import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: [
        "src/**/*.ts",
      ],
      exclude: [
        "node_modules/**",
        "src/app/**",
        "src/components/**",
        "src/i18n/**",
        "src/hooks/**",
        "src/lib/placeholder-images.ts",
        "src/lib/config/**",
        "src/lib/utils.ts",
        "src/middleware.ts",
        "src/modules/testing/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
})