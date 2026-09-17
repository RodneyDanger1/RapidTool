// ---------------------------------------------------------------------------
// vite.config.ts — emitted by the RapidTool scaffold (fixes/135 bootability).
// The webapp package.json declares vite dev/build scripts + the react plugin;
// this config makes them real: index.html + src/main mount the UI shell.
// ---------------------------------------------------------------------------
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
