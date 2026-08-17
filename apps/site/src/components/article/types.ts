export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "heading"; level: 2 | 3; text: string; id: string }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "code"; lang: string | null; code: string }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "quote"; text: string; cite?: string };
