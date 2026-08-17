import { deriveReadTime } from "@/components/article/read-time";
import type { ArticleBlock } from "@/components/article/types";
import { productIcons, type ProductName } from "../stories/data";
import { getStoryBanner, type StoryBanner } from "./banners";

export type StorySection = { heading: string; blocks: ArticleBlock[] };

export type StoryContent = {
  slug: string;
  company: string;
  sourceUrl: string | null;
  title: string;
  quote: { text: string[]; author: string; role: string };
  summaryHeadline: string;
  summaryBody: string[];
  sections: StorySection[];
  productsUsed: string[];
  industry: string;
  region: string;
  date: string;
};

export type StoryDetail = StoryContent & {
  banner: StoryBanner;
  products: ProductName[];
  readTime: number;
};

function storyBlocks(content: StoryContent): ArticleBlock[] {
  return [
    ...content.summaryBody.map((text): ArticleBlock => ({ type: "p", text })),
    ...content.sections.flatMap((section) => section.blocks),
  ];
}

const contents = Object.values(
  import.meta.glob("./content/*.json", { eager: true, import: "default" })
) as StoryContent[];

export const STORY_DETAILS: Record<string, StoryDetail> = {};

for (const content of contents) {
  const banner = getStoryBanner(content.slug);
  if (!banner) continue;

  STORY_DETAILS[content.slug] = {
    ...content,
    banner,
    products: content.productsUsed.filter(
      (product): product is ProductName => product in productIcons
    ),
    readTime: deriveReadTime(storyBlocks(content)),
  };
}
