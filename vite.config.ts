import { defineConfig } from "vite";

// Static build viewed through the shared devserver, so every URL is relative.
export default defineConfig({ base: "./", build: { assetsInlineLimit: 0 } });
