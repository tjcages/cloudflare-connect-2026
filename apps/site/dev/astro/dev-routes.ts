import type { AstroIntegration } from "astro";

export function devRoutes(): AstroIntegration {
  return {
    name: "dev-routes",
    hooks: {
      "astro:config:setup": ({ command, injectRoute }) => {
        if (command !== "dev") return;

        injectRoute({
          pattern: "/playground",
          entrypoint: new URL(
            "../../src/dev-pages/playground.astro",
            import.meta.url
          ),
        });

        injectRoute({
          pattern: "/cta-shader",
          entrypoint: new URL(
            "../../src/dev-pages/cta-shader.astro",
            import.meta.url
          ),
        });
      },
    },
  };
}
