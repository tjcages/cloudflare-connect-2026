declare module "virtual:command-menu-index" {
  export interface BlogPostIndexEntry {
    readonly slug: string;
    readonly title: string;
    readonly excerpt: string;
    readonly publishedAt: string;
    readonly sourceUrl: string;
    readonly tags: readonly string[];
    readonly cover: string | null;
  }

  export interface CaseStudyIndexEntry {
    readonly slug: string;
    readonly company: string;
    readonly title: string;
    readonly summaryHeadline: string;
    readonly productsUsed: readonly string[];
    readonly industry: string;
  }

  export const BLOG_POSTS: readonly BlogPostIndexEntry[];
  export const CASE_STUDIES: readonly CaseStudyIndexEntry[];
}
