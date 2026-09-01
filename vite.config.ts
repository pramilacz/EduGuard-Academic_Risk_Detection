// @lovable.dev/vite-tanstack-config already includes TanStack Start,
// React, Tailwind, tsconfig paths, Nitro, and other required plugins.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isVercel = Boolean(process.env["VERCEL"]);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  nitro: isVercel
    ? {
        preset: "vercel",
      }
    : true,
});