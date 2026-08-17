import { BLOG_POSTS, CASE_STUDIES } from "virtual:command-menu-index";
import { caseStudyLogos } from "@/components/_pages/case-studies/logos/logos";
import { catalogProductGroups } from "@/constants/products";
import { searchCommandMenuRecords } from "./ranking";
import { commandMenuSuggestions } from "./suggestions";
import type {
  CommandMenuGroup,
  CommandMenuSearchRecord,
  CommandMenuSearchResult,
} from "./types";

const pageRecords: CommandMenuSearchRecord[] = commandMenuSuggestions.map(
  (item) => ({
    ...item,
    groupId: "pages",
    groupLabel: "Pages",
    groupOrder: 0,
    kind: "page",
    keywords: [],
  })
);

const productRecords: CommandMenuSearchRecord[] = catalogProductGroups.flatMap(
  (group, groupIndex) =>
    [...group.items, ...(group.secondaryItems ?? [])]
      .filter((item) => item.href !== "#")
      .map((item) => ({
        ...item,
        id: `product:${group.slug}:${item.href}`,
        groupId: `product:${group.slug}`,
        groupLabel: group.label,
        groupOrder: 10 + groupIndex,
        kind: "product" as const,
        keywords: [group.label],
      }))
);

const caseStudyRecords: CommandMenuSearchRecord[] = CASE_STUDIES.map(
  (study) => ({
    id: `case-study:${study.slug}`,
    label: study.company,
    description: study.summaryHeadline || study.title,
    href: `/case-studies/${study.slug}`,
    iconName: "command-case-studies",
    logo: caseStudyLogos[study.slug],
    logoClass: `story-brand-${study.slug}`,
    groupId: "case-studies",
    groupLabel: "Case Studies",
    groupOrder: 100,
    kind: "case-study",
    keywords: [
      study.title,
      study.summaryHeadline,
      study.industry,
      ...study.productsUsed,
    ],
  })
);

const blogPostRecords: CommandMenuSearchRecord[] = BLOG_POSTS.map((post) => ({
  id: `post:${post.slug}`,
  label: post.title,
  description: post.excerpt,
  href: post.sourceUrl,
  iconName: "resource-blog",
  cover: post.cover ?? undefined,
  groupId: "posts",
  groupLabel: "Posts",
  groupOrder: 200,
  kind: "post",
  keywords: [...post.tags],
  publishedAt: post.publishedAt,
}));

const localRecords = [
  ...pageRecords,
  ...productRecords,
  ...caseStudyRecords,
  ...blogPostRecords,
];

const remoteRecord = (
  result: CommandMenuSearchResult
): CommandMenuSearchRecord => ({
  ...result,
  groupId: "posts",
  groupLabel: "Posts",
  groupOrder: 200,
  kind: "post",
  keywords: [],
});

export function searchLocalCommandMenu(
  query: string,
  remoteResults: readonly CommandMenuSearchResult[] = []
): CommandMenuGroup[] {
  return searchCommandMenuRecords(
    [...localRecords, ...remoteResults.map(remoteRecord)],
    query
  );
}
