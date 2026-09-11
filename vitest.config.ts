import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@wataseru/shared": resolve(root, "shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["server/src/**/*.test.ts", "shared/src/**/*.test.ts"],
  },
});
