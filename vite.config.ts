import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// Each product gets its own icon so they're easy to tell apart: City = skyline (icons/city.*), Agent Graph = network
// hub (icons/graph.*). public/ holds the City set for dev; this swaps in the right set after a build.
// It also writes manifest.webmanifest, which makes each product an installable app ("Install" window).
function productIcon(product: string, outDir: string): Plugin {
  const name = product === "graph" ? "graph" : "city";
  return {
    name: "product-icon",
    closeBundle() {
      const src = path.resolve(__dirname, "icons");
      const cp = (from: string, to: string) => fs.copyFileSync(path.join(src, from), path.join(outDir, to));
      cp(`${name}.svg`, "favicon.svg");
      cp(`${name}-180.png`, "apple-touch-icon.png");
      cp(`${name}-192.png`, "icon-192.png");
      cp(`${name}-512.png`, "icon-512.png");
      cp(`${name}-maskable-512.png`, "icon-maskable-512.png");
      const m = JSON.parse(fs.readFileSync(path.resolve(__dirname, "public", "manifest.webmanifest"), "utf8"));
      m.name = name === "graph" ? "Agent City · Agent Graph" : "Agent City";
      m.short_name = name === "graph" ? "Agent Graph" : "City";
      fs.writeFileSync(path.join(outDir, "manifest.webmanifest"), JSON.stringify(m, null, 2));
    },
  };
}

// Three builds from one codebase:
//   npm run build          -> dist/        both products (City + Agent Graph)
//   npm run build:city     -> dist-city/   City only (no Agent Graph code)
//   npm run build:graph    -> dist-graph/  Agent Graph only (no 3D engine - small and fast)
export default defineConfig(({ mode }) => {
  const product = mode === "city" || mode === "graph" ? mode : "both";
  const outDir = product === "both" ? "dist" : `dist-${product}`;
  return {
    plugins: [react(), productIcon(product, path.resolve(__dirname, outDir))],
    base: "./",
    define: { "import.meta.env.VITE_PRODUCT": JSON.stringify(product) },
    build: { outDir, chunkSizeWarningLimit: 1600, emptyOutDir: true },
    server: { host: "127.0.0.1" },
  };
});
