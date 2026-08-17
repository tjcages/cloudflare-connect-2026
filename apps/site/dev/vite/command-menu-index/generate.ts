import fs from "node:fs";
import path from "node:path";

export interface BlogPostIndexEntry {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  sourceUrl: string;
  tags: string[];
  cover: string | null;
}

export interface CaseStudyIndexEntry {
  slug: string;
  company: string;
  title: string;
  summaryHeadline: string;
  productsUsed: string[];
  industry: string;
}

export interface CommandMenuIndex {
  blogPosts: BlogPostIndexEntry[];
  caseStudies: CaseStudyIndexEntry[];
}

const excludedBlogFiles = new Set(["authors.json", "tags.json"]);

const readRecord = (file: string): Record<string, unknown> => {
  const value = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected an object in ${file}`);
  }
  return value as Record<string, unknown>;
};

const readString = (
  record: Record<string, unknown>,
  field: string,
  file: string
): string => {
  const value = record[field];
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string in ${file}`);
  }
  return value;
};

const readStrings = (
  record: Record<string, unknown>,
  field: string,
  file: string
): string[] => {
  const value = record[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Expected ${field} to be a string array in ${file}`);
  }
  return value;
};

const jsonFiles = (dir: string, excluded = new Set<string>()): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        !excluded.has(entry.name)
    )
    .map((entry) => path.join(dir, entry.name))
    .sort();

const readCover = (record: Record<string, unknown>): string | null => {
  const cover = record.cover;
  if (typeof cover !== "object" || cover === null) return null;
  const src = (cover as Record<string, unknown>).src;
  return typeof src === "string" && src.length > 0 ? src : null;
};

const readBlogPosts = (dir: string): BlogPostIndexEntry[] =>
  jsonFiles(dir, excludedBlogFiles).map((file) => {
    const post = readRecord(file);
    return {
      slug: readString(post, "slug", file),
      title: readString(post, "title", file),
      excerpt: readString(post, "excerpt", file),
      publishedAt: readString(post, "publishedAt", file),
      sourceUrl: readString(post, "sourceUrl", file),
      tags: readStrings(post, "tags", file),
      cover: readCover(post),
    };
  });

const readCaseStudies = (dir: string): CaseStudyIndexEntry[] =>
  jsonFiles(dir).map((file) => {
    const caseStudy = readRecord(file);
    return {
      slug: readString(caseStudy, "slug", file),
      company: readString(caseStudy, "company", file),
      title: readString(caseStudy, "title", file),
      summaryHeadline: readString(caseStudy, "summaryHeadline", file),
      productsUsed: readStrings(caseStudy, "productsUsed", file),
      industry: readString(caseStudy, "industry", file),
    };
  });

export const buildCommandMenuIndex = (
  blogDir: string,
  caseStudyDir: string
): CommandMenuIndex => ({
  blogPosts: readBlogPosts(blogDir),
  caseStudies: readCaseStudies(caseStudyDir),
});

export const renderCommandMenuIndexModule = ({
  blogPosts,
  caseStudies,
}: CommandMenuIndex): string =>
  `export const BLOG_POSTS = ${JSON.stringify(blogPosts)};\nexport const CASE_STUDIES = ${JSON.stringify(caseStudies)};\n`;
