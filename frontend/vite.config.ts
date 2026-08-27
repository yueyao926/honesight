import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@rive-app")) return "rive";
          if (
            id.includes("/react/") ||
            id.includes("react-dom") ||
            id.includes("react-router")
          ) {
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      // Windows: avoid EBUSY crash when SVG files are open in the editor
      usePolling: process.platform === "win32",
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/uploads": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
      },
    },
  },
});
