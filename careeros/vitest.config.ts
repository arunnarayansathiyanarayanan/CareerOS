import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const fromFiles = loadEnv(mode, process.cwd(), "");
  return {
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/__tests__/e3-proof-of-work.test.ts"],
      fileParallelism: false,
      testTimeout: 120_000,
      hookTimeout: 120_000,
      env: {
        ...fromFiles,
        NEXT_PUBLIC_APP_URL:
          fromFiles.NEXT_PUBLIC_APP_URL || "https://careeros.com",
      },
    },
  };
});
