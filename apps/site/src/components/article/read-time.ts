import type { ArticleBlock } from "./types";

export function deriveReadTime(blocks: ArticleBlock[]) {
  const texts: string[] = [];

  for (const block of blocks) {
    if (block.type === "p") texts.push(block.text);
    else if (block.type === "list") texts.push(...block.items);
    else if (block.type === "heading") texts.push(block.text);
    else if (block.type === "quote") texts.push(block.text);
    else if (block.type === "table") {
      texts.push(...block.head);
      for (const row of block.rows) texts.push(...row);
    }
  }

  const words = texts.join(" ").split(/\s+/).filter(Boolean).length;

  return Math.max(3, Math.round(words / 200));
}
