export const TAG_GRID_SIZE = 12;
export const HOME_ARCHIVE_START = 25;

export type BlogTagView = { slug: string | null; label: string | null };

const VIEW_EVENT = "blogtagview";

let published: BlogTagView | null = null;

export function blogDocumentTitle(label: string | null): string {
  return label
    ? `${label} - Cloudflare Blog`
    : "Cloudflare Blog - Product News, Deep Dives, and Research";
}

export function blogTagPath(slug: string | null): string {
  return slug ? `/blog/tag/${slug}` : "/blog";
}

export function blogTagFromPath(pathname: string): string | null {
  const match = /^\/blog\/tag\/([^/]+)\/?$/.exec(pathname);
  return match ? match[1] : null;
}

export function archiveFor<T extends { tags: string[] }>(
  entries: T[],
  slug: string | null
): T[] {
  return slug === null
    ? entries.slice(HOME_ARCHIVE_START)
    : entries.filter((entry) => entry.tags.includes(slug)).slice(TAG_GRID_SIZE);
}

export function readBlogTagView(): BlogTagView | null {
  return published;
}

export function publishBlogTagView(view: BlogTagView) {
  published = view;
  window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: view }));
}

export function onBlogTagView(listener: (view: BlogTagView) => void) {
  const handler = (event: Event) =>
    listener((event as CustomEvent<BlogTagView>).detail);

  window.addEventListener(VIEW_EVENT, handler);
  return () => window.removeEventListener(VIEW_EVENT, handler);
}
