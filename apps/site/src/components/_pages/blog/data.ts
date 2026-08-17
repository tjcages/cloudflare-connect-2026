import { deriveReadTime } from "@/components/article/read-time";
import type { ArticleBlock } from "@/components/article/types";
import authorRecords from "./content/authors.json";
import tagRecords from "./content/tags.json";

export type PostCover = { src: string; alt: string };

export type PostContent = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  sourceUrl: string;
  tags: string[];
  authors: string[];
  cover: PostCover | null;
  blocks: ArticleBlock[];
};

export type Post = PostContent & { readTime: number };

export type AuthorSocial = { kind: string; href: string };

export type Author = {
  slug: string;
  name: string;
  avatar: string;
  location: string | null;
  socials: AuthorSocial[];
  posts: Post[];
};

export type Tag = {
  slug: string;
  label: string;
  count: number;
};

export type ArchiveEntry = {
  slug: string;
  title: string;
  byline: string;
  date: string;
};

export type TaggedArchiveEntry = ArchiveEntry & { tags: string[] };

const contents = Object.entries(
  import.meta.glob("./content/*.json", { eager: true, import: "default" })
)
  .filter(([path]) => !/\/(authors|tags)\.json$/.test(path))
  .map(([, content]) => content as PostContent);

export const POSTS: Post[] = contents
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  .map((content) => ({ ...content, readTime: deriveReadTime(content.blocks) }));

export const POSTS_BY_SLUG: Record<string, Post> = {};

for (const post of POSTS) POSTS_BY_SLUG[post.slug] = post;

const authorDictionary = authorRecords as unknown as Record<
  string,
  Omit<Author, "posts">
>;

const tagDictionary = tagRecords as unknown as Record<
  string,
  Omit<Tag, "count">
>;

export const AUTHORS: Record<string, Author> = {};

for (const [slug, record] of Object.entries(authorDictionary)) {
  AUTHORS[slug] = { ...record, posts: [] };
}

export const TAGS: Record<string, Tag> = {};

for (const [slug, record] of Object.entries(tagDictionary)) {
  TAGS[slug] = { ...record, count: 0 };
}

const postsByTagSlug: Record<string, Post[]> = {};

for (const post of POSTS) {
  for (const slug of post.authors) AUTHORS[slug]?.posts.push(post);

  for (const slug of post.tags) {
    (postsByTagSlug[slug] ??= []).push(post);
    if (TAGS[slug]) TAGS[slug].count += 1;
  }
}

export function postsByTag(slug: string): Post[] {
  return postsByTagSlug[slug] ?? [];
}

export function postsByAuthor(slug: string): Post[] {
  return AUTHORS[slug]?.posts ?? [];
}

export function authorsOf(post: Post): Author[] {
  return post.authors
    .map((slug) => AUTHORS[slug])
    .filter((author): author is Author => Boolean(author));
}

export function tagsOf(post: Post): Tag[] {
  return post.tags
    .map((slug) => TAGS[slug])
    .filter((tag): tag is Tag => Boolean(tag));
}

export function relatedPosts(slug: string): Post[] {
  let start = POSTS.findIndex((post) => post.slug === slug);

  if (start === -1) {
    let sum = 0;
    for (const char of slug) sum += char.charCodeAt(0);
    start = sum % POSTS.length;
  }

  return [-3, -2, -1].map(
    (offset) => POSTS[(start + offset + POSTS.length) % POSTS.length]
  );
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatPostDate(publishedAt: string): string {
  return dateFormat.format(new Date(publishedAt));
}

export function bylineOf(post: Post): string {
  const authors = authorsOf(post);

  if (authors.length === 1) return authors[0].name;

  return `${authors.length} authors`;
}

function archiveEntry(post: Post): ArchiveEntry {
  return {
    slug: post.slug,
    title: post.title,
    byline: bylineOf(post),
    date: formatPostDate(post.publishedAt),
  };
}

export function archiveEntries(posts: Post[]): ArchiveEntry[] {
  return posts.map(archiveEntry);
}

export function taggedArchiveEntries(posts: Post[]): TaggedArchiveEntry[] {
  return posts.map((post) => ({ ...archiveEntry(post), tags: post.tags }));
}
