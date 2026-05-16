import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/interview/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
