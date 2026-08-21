import { describe, expect, it } from "vitest";
import {
  CONNECT_MACHINE_PAGES,
  CONNECT_MACHINE_ROUTES,
  getConnectMachinePage,
  normalizeConnectPath,
} from "./machine-page-data";

describe("connect machine pages", () => {
  it("has a route-aware machine document for every Connect page", () => {
    expect(Object.keys(CONNECT_MACHINE_PAGES)).toHaveLength(
      CONNECT_MACHINE_ROUTES.length
    );

    for (const route of CONNECT_MACHINE_ROUTES) {
      const page = getConnectMachinePage(route.href);
      expect(page.path.replace(/\/$/, "")).toBe(route.href.replace(/\/$/, ""));
      expect(page.sections.length).toBeGreaterThan(2);
    }
  });

  it("normalizes the Connect root and trailing slashes", () => {
    expect(normalizeConnectPath("/connect")).toBe("/connect/");
    expect(normalizeConnectPath("/connect/")).toBe("/connect/");
    expect(normalizeConnectPath("/connect/faq/")).toBe("/connect/faq");
  });

  it("falls back to the event overview for unknown Connect routes", () => {
    expect(getConnectMachinePage("/connect/not-a-page").path).toBe("/connect/");
  });

  it("publishes the machine navigation and sponsor data route", () => {
    const home = getConnectMachinePage("/connect/");
    const pages = home.sections.find((section) => section.title === "pages");
    const data = home.sections.find(
      (section) => section.title === "data-route"
    );

    expect(pages?.kind).toBe("list");
    expect(data?.kind).toBe("definitions");
  });
  it("keeps the supplied homepage event facts exact", () => {
    const home = getConnectMachinePage("/connect/");
    const pricing = home.sections.find(
      (section) => section.title === "pricing (USD)"
    );
    const agenda = home.sections.find((section) => section.title === "agenda");

    expect(pricing).toMatchObject({
      kind: "definitions",
      rows: expect.arrayContaining([
        { label: "conference-pass", value: "$595" },
        {
          label: "university",
          value: "$495  add-on, full-day technical training",
        },
      ]),
    });
    expect(agenda).toMatchObject({
      kind: "list",
      items: expect.arrayContaining([
        expect.stringContaining("Cloudflare After Dark"),
        expect.stringContaining("func(tion)"),
      ]),
    });
  });
});
