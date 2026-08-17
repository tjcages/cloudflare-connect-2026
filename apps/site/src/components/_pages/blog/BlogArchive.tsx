import { useEffect, useState } from "react";
import type { IslandProps } from "@/types/island-props";
import ArchiveTable from "./ArchiveTable";
import type { TaggedArchiveEntry } from "./data";
import { archiveFor, onBlogTagView, readBlogTagView } from "./view";

export default function BlogArchive({
  entries,
  tag,
}: IslandProps<{ entries: TaggedArchiveEntry[]; tag: string | null }>) {
  const [slug, setSlug] = useState(tag);

  useEffect(() => {
    const published = readBlogTagView();
    if (published) setSlug(published.slug);

    return onBlogTagView((view) => setSlug(view.slug));
  }, []);

  return (
    <ArchiveTable entries={archiveFor(entries, slug)} key={slug ?? "all"} />
  );
}
