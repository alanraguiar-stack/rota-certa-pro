import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    esbuildOptions: {
      drop: mode === "production" ? ["console", "debugger"] : [],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Cada grupo vira um chunk separado — o browser faz cache independente
          // Se o app mudar mas o Leaflet não, o usuário não re-baixa o mapa
          "vendor-maps":  ["leaflet", "react-leaflet"],
          "vendor-pdf":   ["jspdf", "jspdf-autotable", "pdfjs-dist"],
          "vendor-excel": ["xlsx"],
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
