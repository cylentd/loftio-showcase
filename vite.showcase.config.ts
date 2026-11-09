import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const page = (name: string) => fileURLToPath(new URL(`showcase/${name}`, import.meta.url));

// The public showcase: its pages live in showcase/ and it builds to dist-showcase/ (the export builds to dist/ with
// --outDir). Static build viewed through the shared devserver or any host, so every URL is relative.
export default defineConfig({
  root: "showcase",
  publicDir: "../public",
  base: "./",
  build: {
    outDir: "../dist-showcase",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: { input: { loft: page("index.html"), builder: page("builder.html") } },
  },
});
