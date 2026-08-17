export type PageId =
  | "home"
  | "developer-platform"
  | "developer-platform-scroll"
  | "connectivity-cloud"
  | "application-services";

export type ThemeShots = Record<"light" | "dark", Record<PageId, string>>;

export type ActId = "screenshot" | "playwright" | "markdown" | "crawl" | "json";

export type Surface =
  | { kind: "page"; page: PageId; tall?: boolean }
  | { kind: "markdown" }
  | { kind: "json" };

export interface Beat {
  at: number;
  surface: Surface;
}

export interface Act {
  beats: Beat[];
  flashAt?: number;
  cursor?: {
    path: [number, number][];
    times: number[];
    start: number;
    duration: number;
    clickAt: number;
  };
  scroll?: { at: number; to: number; duration: number };
  scan?: { delay: number; duration: number };
  completeAfterSurface?: number;
  runFor?: number;
}

export const DEFAULT_RUN_MS = 3000;

export const ACTS: Record<ActId, Act> = {
  screenshot: {
    beats: [{ at: 0, surface: { kind: "page", page: "home" } }],
    flashAt: 1250,
    runFor: 2100,
  },
  playwright: {
    beats: [
      {
        at: 0,
        surface: {
          kind: "page",
          page: "developer-platform-scroll",
          tall: true,
        },
      },
    ],
    cursor: {
      path: [
        [286, 170],
        [230, 154],
        [48, 98],
      ],
      times: [0, 0.18, 1],
      start: 2350,
      duration: 0.9,
      clickAt: 3450,
    },
    scroll: { at: 500, to: -430, duration: 1.45 },
    runFor: 3450,
  },
  markdown: {
    beats: [{ at: 0, surface: { kind: "markdown" } }],
  },
  crawl: {
    beats: [
      {
        at: 0,
        surface: { kind: "page", page: "connectivity-cloud" },
      },
      {
        at: 1550,
        surface: { kind: "page", page: "application-services" },
      },
      {
        at: 3100,
        surface: { kind: "page", page: "developer-platform" },
      },
    ],
    scan: { delay: 0.4, duration: 1 },
    runFor: 4650,
  },
  json: {
    beats: [{ at: 0, surface: { kind: "json" } }],
    completeAfterSurface: 200,
  },
};

export const MARKDOWN_LINES = [
  { text: "# Developers who know use Cloudflare", tone: "heading" },
  { text: "", tone: "body" },
  { text: "All the primitives you need to build full-stack", tone: "body" },
  { text: "and AI applications", tone: "body" },
  { text: "", tone: "body" },
  { text: "[Compare plans and pricing](/plans)", tone: "link" },
  { text: "[Sign up for demo](/lp/demo)", tone: "link" },
  { text: "", tone: "body" },
  { text: "## Benefits", tone: "heading" },
  { text: "", tone: "body" },
  { text: "Build on scalable infrastructure in the", tone: "body" },
  { text: "connectivity cloud", tone: "body" },
  { text: "", tone: "body" },
  { text: "## Analyst recognition", tone: "heading" },
  { text: "", tone: "body" },
  { text: "What top analysts say", tone: "body" },
] as const;

export const JSON_LINES = [
  { text: "{", tone: "punct" },
  {
    text: '  "url": "https://cloudflare.com/developer-platform",',
    tone: "pair",
  },
  { text: '  "title": "Cloudflare Developer Platform",', tone: "pair" },
  { text: '  "heading": "Developers who know use Cloudflare",', tone: "pair" },
  { text: '  "description": "All the primitives you need to', tone: "pair" },
  {
    text: '                  build full-stack and AI applications",',
    tone: "pair",
  },
  { text: '  "actions": [', tone: "pair" },
  { text: '    "Compare plans and pricing",', tone: "string" },
  { text: '    "Sign up for demo"', tone: "string" },
  { text: "  ]", tone: "punct" },
  { text: "}", tone: "punct" },
] as const;
