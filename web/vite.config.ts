import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [
    tanstackRouter({
      target: "react",
      routesDirectory: resolve(root, "src/routes"),
      generatedRouteTree: resolve(root, "src/routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": resolve(root, "src"),
      "@wataseru/shared": resolve(root, "../shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/uploads": "http://127.0.0.1:8787",
    },
  },
  preview: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787",
      "/uploads": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: resolve(root, "dist"),
    emptyOutDir: true,
  },
});
