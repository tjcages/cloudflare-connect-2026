import type { CommandMenuSearchResult } from "./types";

const endpoint =
  "https://ai-search.blog.cloudflare.com/search?lang=en-us&version=v2";
const maxResults = 10;

type SearchChunk = {
  item?: {
    key?: unknown;
    metadata?: {
      title?: unknown;
      description?: unknown;
      image?: unknown;
    };
  };
};

type SearchResponse = {
  result?: {
    chunks?: unknown;
  };
};

const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
};

const codePoint = (value: number) =>
  Number.isInteger(value) && value > 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : null;

const decodeEntities = (value: string) =>
  value.replace(
    /&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g,
    (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        return codePoint(Number.parseInt(entity.slice(2), 16)) ?? match;
      }
      if (entity.startsWith("#")) {
        return codePoint(Number(entity.slice(1))) ?? match;
      }
      return namedEntities[entity.toLowerCase()] ?? match;
    }
  );

const isArchivePath = (pathname: string) =>
  pathname === "/" || /^\/(tag|author|page)\//.test(pathname);

const blogImageUrl = (value: unknown) => {
  if (typeof value !== "string" || !value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "blog.cloudflare.com"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stringValue = (value: unknown) =>
  typeof value === "string" ? decodeEntities(value).trim() : "";

const normalizeChunk = (chunk: SearchChunk): CommandMenuSearchResult | null => {
  const key = stringValue(chunk.item?.key);
  if (!key) return null;

  let url: URL;
  try {
    url = new URL(key);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname !== "blog.cloudflare.com") {
    return null;
  }

  if (isArchivePath(url.pathname)) return null;

  const title = stringValue(chunk.item?.metadata?.title) || "Cloudflare Blog";
  const description =
    stringValue(chunk.item?.metadata?.description) || "Cloudflare Blog";

  return {
    id: url.href,
    label: title,
    description,
    href: url.href,
    iconName: "resource-blog",
    kind: "post",
    cover: blogImageUrl(chunk.item?.metadata?.image),
  };
};

const getChunks = (value: unknown): SearchChunk[] => {
  if (!isRecord(value)) return [];

  const result = value.result;
  if (!isRecord(result) || !Array.isArray(result.chunks)) return [];

  return result.chunks.filter(isRecord) as SearchChunk[];
};

export const searchCommandMenu = async (
  query: string,
  signal?: AbortSignal
): Promise<CommandMenuSearchResult[]> => {
  if (!query.trim()) return [];

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-ai-search-source": "snippet-search",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: query }],
      stream: false,
      ai_search_options: {
        retrieval: {
          metadata_only: true,
          max_num_results: 15,
        },
      },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Command menu search failed with status ${response.status}`
    );
  }

  const chunks = getChunks((await response.json()) as SearchResponse);
  const seen = new Set<string>();
  const results: CommandMenuSearchResult[] = [];

  for (const chunk of chunks) {
    const result = normalizeChunk(chunk);
    if (!result || seen.has(result.href)) continue;

    seen.add(result.href);
    results.push(result);
    if (results.length === maxResults) break;
  }

  return results;
};
