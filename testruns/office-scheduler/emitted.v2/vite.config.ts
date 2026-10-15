// ---------------------------------------------------------------------------
// vite.config.ts — emitted by the RapidTool scaffold (fixes/135 bootability).
// The webapp package.json declares the vite dev/build scripts + the react and
// tailwindcss plugins (W52 / 338-5: tailwindcss wired so no declared devDep is
// inert); this config makes them real: index.html + src/main mount the UI shell
// and src/styles.css is the Tailwind v4 CSS entry the plugin compiles.
// ---------------------------------------------------------------------------
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
