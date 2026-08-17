import type { APIRoute } from "astro";
import { POSTS } from "@/components/_pages/blog/data";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const GET: APIRoute = ({ site }) => {
  const feedUrl = new URL("/blog/rss.xml", site).href;
  const blogUrl = new URL("/blog", site).href;

  const items = POSTS.map((post) => {
    const url = new URL(`/blog/${post.slug}`, site).href;

    return [
      "    <item>",
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>`,
      `      <description>${escapeXml(post.excerpt)}</description>`,
      "    </item>",
    ].join("\n");
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Cloudflare Blog</title>",
    `    <link>${escapeXml(blogUrl)}</link>`,
    "    <description>Technical deep dives, product updates, and insights from the teams that are helping to build a better Internet.</description>",
    "    <language>en-us</language>",
    `    <lastBuildDate>${new Date(POSTS[0].publishedAt).toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
