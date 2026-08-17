import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import svgr from "vite-plugin-svgr";
import { devRoutes } from "./dev/astro/dev-routes";
import { commandMenuIndex } from "./dev/vite/command-menu-index";
import { freshModules } from "./dev/vite/fresh-modules";
import { icons } from "./dev/vite/icons";
import { lottieSvg } from "./dev/vite/lottie-svg";

const isDev = process.argv.includes("dev");

// https://astro.build/config
export default defineConfig({
  site: "https://connect-2026-site.off-brand.workers.dev",
  output: "static",
  compressHTML: true,

  redirects: {
    "/": { status: 302, destination: "/products/workers" },
  },

  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 4321,
    host: true,
  },

  adapter: isDev ? undefined : cloudflare({ imageService: "compile" }),

  integrations: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    devRoutes(),
  ],

  fonts: [
    {
      provider: fontProviders.local(),
      name: "STK Bureau Sans",
      cssVariable: "--font-stk-bureau-sans",
      fallbacks: ["sans-serif"],
      options: {
        variants: [
          {
            weight: 300,
            style: "normal",
            src: ["./src/assets/fonts/STKBureauSans-Book.woff2"],
          },
          {
            weight: 400,
            style: "normal",
            src: ["./src/assets/fonts/STKBureauSans-Regular.woff2"],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "STK Bureau Serif",
      cssVariable: "--font-stk-bureau-serif",
      fallbacks: ["serif"],
      options: {
        variants: [
          {
            weight: 400,
            style: "normal",
            src: ["./src/assets/fonts/STKBureauSerif-Regular.woff2"],
          },
          {
            weight: 400,
            style: "italic",
            src: ["./src/assets/fonts/STKBureauSerif-Italic.woff2"],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Paper Mono",
      cssVariable: "--font-paper-mono",
      fallbacks: ["monospace"],
      options: {
        variants: [
          {
            weight: "100 800",
            style: "normal",
            src: ["./src/assets/fonts/PaperMonoVariable.woff2"],
          },
        ],
      },
    },
  ],

  vite: {
    server: {
      watch: {
        ignored: [fileURLToPath(new URL("./.claude/**", import.meta.url))],
      },
    },
    plugins: [
      freshModules(),
      commandMenuIndex(),
      svgr({ svgrOptions: { svgo: false }, include: "**/*.svg?react" }),
      tailwindcss(),
      icons(),
      lottieSvg(),
    ],
  },

  devToolbar: {
    enabled: false,
  },
});
