import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/health": "http://127.0.0.1:8000",
      "/auth": "http://127.0.0.1:8000",
      "/users": "http://127.0.0.1:8000",
      "/roles": "http://127.0.0.1:8000",
      "/permissions": "http://127.0.0.1:8000",
      "/audit-events": "http://127.0.0.1:8000",
    },
  },
});
