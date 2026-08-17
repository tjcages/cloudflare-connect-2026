import { describe, expect, it } from "vitest";
import type { CatalogGroup } from "./types";
import { catalogProductGroups } from "@/constants/products";
import { buildCatalogSearch, filterGroups, parseCatalogParams } from "./filter";
import { searchCommandMenuRecords } from "../header/command-menu/ranking";

const item = (label: string, description = "") =>
  ({
    label,
    description,
    href: "#",
    iconName: "product-workers",
  }) as CatalogGroup["items"][number];

const groups: CatalogGroup[] = [
  {
    label: "Compute",
    slug: "compute",
    items: [
      item("Workers", "Global serverless functions"),
      item("Containers", "Any language"),
    ],
    secondaryItems: [item("Cloudflare Pages")],
  },
  {
    label: "Media",
    slug: "media",
    items: [item("Stream", "Video streaming")],
  },
];

describe("filterGroups", () => {
  it("returns groups unchanged for an empty or whitespace query", () => {
    expect(filterGroups(groups, "")).toEqual(groups);
    expect(filterGroups(groups, "   ")).toEqual(groups);
  });

  it("matches item labels case-insensitively and drops empty groups", () => {
    const result = filterGroups(groups, "workers");
    expect(result).toHaveLength(1);
    expect(result[0].items.map((i) => i.label)).toEqual(["Workers"]);
    expect(result[0].secondaryItems).toEqual([]);
  });

  it("matches descriptions", () => {
    const result = filterGroups(groups, "video");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("media");
  });

  it("matches secondary items", () => {
    const result = filterGroups(groups, "pages");
    expect(result).toHaveLength(1);
    expect(result[0].items).toEqual([]);
    expect(result[0].secondaryItems?.map((i) => i.label)).toEqual([
      "Cloudflare Pages",
    ]);
  });

  it("keeps a whole group when the query matches the group label", () => {
    const result = filterGroups(groups, "compute");
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(2);
    expect(result[0].secondaryItems).toHaveLength(1);

    const mediaResult = filterGroups([groups[1]], "media");
    expect(mediaResult[0].secondaryItems).toEqual([]);
  });

  it("returns [] when nothing matches", () => {
    expect(filterGroups(groups, "zzzz")).toEqual([]);
  });

  it("fuzzy-matches in-order subsequences for typo tolerance", () => {
    expect(filterGroups(groups, "wrkers")[0].items.map((i) => i.label)).toEqual(
      ["Workers"]
    );
    expect(
      filterGroups(groups, "cntainers")[0].items.map((i) => i.label)
    ).toEqual(["Containers"]);
  });

  it("requires every token to match the same item", () => {
    const result = filterGroups(groups, "global functions");
    expect(result).toHaveLength(1);
    expect(result[0].items.map((i) => i.label)).toEqual(["Workers"]);

    expect(filterGroups(groups, "global video")).toEqual([]);
  });

  it("keeps queries under 3 chars substring-only", () => {
    expect(filterGroups(groups, "vd")).toEqual([]);
  });
});

describe("parseCatalogParams", () => {
  const slugs = ["compute", "media"];

  it("parses valid category and q", () => {
    expect(parseCatalogParams("?category=media&q=video", slugs)).toEqual({
      category: "media",
      q: "video",
    });
  });

  it("rejects unknown categories", () => {
    expect(parseCatalogParams("?category=nope", slugs)).toEqual({
      category: null,
      q: "",
    });
  });

  it("handles empty/malformed search strings", () => {
    expect(parseCatalogParams("", slugs)).toEqual({ category: null, q: "" });
    expect(parseCatalogParams("?q=%%%", slugs).category).toBeNull();
  });
});

describe("buildCatalogSearch", () => {
  it("returns empty string when nothing is set", () => {
    expect(buildCatalogSearch(null, "")).toBe("");
  });

  it("serializes category and q, encoding q", () => {
    expect(buildCatalogSearch("compute", "")).toBe("?category=compute");
    expect(buildCatalogSearch(null, "a b")).toBe("?q=a+b");
    expect(buildCatalogSearch("compute", "kv")).toBe("?category=compute&q=kv");
    expect(buildCatalogSearch(null, " a b ")).toBe("?q=a+b");
  });
});

describe("catalogProductGroups", () => {
  it("has 7 groups with unique slugs and non-empty primary items", () => {
    expect(catalogProductGroups).toHaveLength(7);
    const slugs = catalogProductGroups.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(7);
    for (const group of catalogProductGroups)
      expect(group.items.length).toBeGreaterThan(0);
  });
});

describe("searchCommandMenuRecords", () => {
  const record = (
    id: string,
    label: string,
    groupId: string,
    groupLabel: string,
    kind: "page" | "product" | "case-study" | "post",
    extra: Record<string, unknown> = {}
  ) => ({
    id,
    label,
    description: `${label} description`,
    href: `/${id}`,
    iconName: "product-workers" as const,
    groupId,
    groupLabel,
    groupOrder: 0,
    kind,
    keywords: [],
    ...extra,
  });

  it("puts a canonical product before related case studies and posts", () => {
    const groups = searchCommandMenuRecords(
      [
        record("workers", "Workers", "compute", "Compute", "product"),
        record("canva", "Canva", "case-studies", "Case Studies", "case-study", {
          keywords: ["Workers", "R2", "Images"],
        }),
        record("workers-builds", "Workers Builds", "posts", "Posts", "post"),
      ],
      "workers"
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Compute",
      "Case Studies",
      "Posts",
    ]);
    expect(groups[0].items[0].href).toBe("/workers");
  });

  it("supports typo-tolerant label matching without including unrelated records", () => {
    const groups = searchCommandMenuRecords(
      [
        record("workers", "Workers", "compute", "Compute", "product"),
        record("containers", "Containers", "compute", "Compute", "product"),
      ],
      "workrs"
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((entry) => entry.label)).toEqual(["Workers"]);
  });

  it("deduplicates canonical URLs and requires every query token to match", () => {
    const groups = searchCommandMenuRecords(
      [
        record("local-post", "Workers Builds", "posts", "Posts", "post", {
          href: "https://blog.cloudflare.com/workers-builds/",
        }),
        record("remote-post", "Workers Builds", "posts", "Posts", "post", {
          href: "https://blog.cloudflare.com/workers-builds",
        }),
        record("workers", "Workers", "compute", "Compute", "product"),
      ],
      "workers builds"
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
    expect(groups[0].items[0].id).toBe("local-post");
  });
});
