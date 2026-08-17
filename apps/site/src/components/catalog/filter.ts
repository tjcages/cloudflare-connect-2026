import type { CatalogGroup, CatalogItem } from "./types";

const matchesToken = (haystack: string, token: string) => {
  if (haystack.includes(token)) return true;
  if (token.length < 3) return false;

  let position = 0;
  for (const char of haystack) {
    if (char === token[position]) position += 1;
    if (position === token.length) return true;
  }
  return false;
};

const matchesTokens = (haystack: string, tokens: string[]) =>
  tokens.every((token) => matchesToken(haystack, token));

export function filterGroups(
  groups: CatalogGroup[],
  query: string
): CatalogGroup[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return groups;

  const result: CatalogGroup[] = [];

  for (const group of groups) {
    if (matchesTokens(group.label.toLowerCase(), tokens)) {
      result.push({ ...group, secondaryItems: group.secondaryItems ?? [] });
      continue;
    }

    const matchesItem = (item: CatalogItem) =>
      matchesTokens(`${item.label} ${item.description}`.toLowerCase(), tokens);

    const items = group.items.filter(matchesItem);
    const secondaryItems = (group.secondaryItems ?? []).filter(matchesItem);

    if (items.length > 0 || secondaryItems.length > 0) {
      result.push({ ...group, items, secondaryItems });
    }
  }

  return result;
}

export function parseCatalogParams(
  search: string,
  validSlugs: string[]
): { category: string | null; q: string } {
  const params = new URLSearchParams(search);
  const rawCategory = params.get("category");
  return {
    category:
      rawCategory && validSlugs.includes(rawCategory) ? rawCategory : null,
    q: params.get("q") ?? "",
  };
}

export function buildCatalogSearch(category: string | null, q: string): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q.trim()) params.set("q", q.trim());
  const search = params.toString();
  return search ? `?${search}` : "";
}
