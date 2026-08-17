import { richTextToPlain } from "@/components/article/rich-text";
import type { ArticleBlock } from "@/components/article/types";

export type TocEntry = {
  id: string;
  text: string;
  level: 2 | 3;
};

export function tableOfContents(blocks: ArticleBlock[]): TocEntry[] {
  return blocks
    .filter((block) => block.type === "heading")
    .map((block) => ({
      id: block.id,
      level: block.level,
      text: richTextToPlain(block.text),
    }));
}
