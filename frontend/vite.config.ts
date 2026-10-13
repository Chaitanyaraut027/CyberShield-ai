import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// `npm run dev`        -> http://<PC-IP>:5173  (camera QR needs HTTPS on phones; use "Take photo" or the HTTPS mode)
// `npm run dev:https`  -> https://<PC-IP>:5173 (self-signed cert: accept the browser warning once; live camera then works on phones)
export default defineConfig(async ({ mode }) => {
  const ssl = mode === "https" ? [(await import("@vitejs/plugin-basic-ssl")).default()] : [];
  return {
    plugins: [react(), tailwindcss(), ...ssl],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: { host: true, port: 5173, proxy: { "/api": { target: process.env.API_TARGET || "http://127.0.0.1:8000", changeOrigin: true } } },
  };
});
