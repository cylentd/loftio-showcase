import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { rumbleRelease } from "./build/rumble-release.mjs";
import { worldRelease } from "./build/world-release.mjs";

const page = (name: string) => fileURLToPath(new URL(`showcase/${name}`, import.meta.url));

// The public showcase: its pages live in showcase/ and it builds to dist-showcase/ (the export builds to dist/ with
// --outDir). Static build viewed through the shared devserver or any host, so every URL is relative.
export default defineConfig({
  plugins: [rumbleRelease(), worldRelease()],
  root: "showcase",
  publicDir: "../public",
  base: "./",
  build: {
    outDir: "../dist-showcase",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: { loft: page("index.html"), builder: page("builder.html"), "resident-reader": page("resident-reader.ts") },
      preserveEntrySignatures: "exports-only",
      output: { entryFileNames: chunk => chunk.name === "resident-reader" ? "play/resident-reader.mjs" : "assets/[name]-[hash].js" },
    },
  },
});
