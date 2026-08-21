import type { APIRoute } from "astro";
import { connectSponsors } from "@/components/_pages/connect/page-data/sponsors";

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        event: "Cloudflare Connect 2026",
        generatedAt: "2026-08-21",
        count: connectSponsors.length,
        sponsors: connectSponsors.map(({ name, website, tier, logo }) => ({
          name,
          website,
          tier,
          logo,
        })),
      },
      null,
      2
    ),
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
