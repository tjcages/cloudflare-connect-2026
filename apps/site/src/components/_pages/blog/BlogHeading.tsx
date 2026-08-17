import { useEffect, useState } from "react";
import WordFade from "@/components/_animations/shared/swap/WordFade";
import type { IslandProps } from "@/types/island-props";
import { onBlogTagView, readBlogTagView } from "./view";

export default function BlogHeading({ title }: IslandProps<{ title: string }>) {
  const [text, setText] = useState(title);

  useEffect(() => {
    const published = readBlogTagView();
    if (published) setText(published.label ?? title);

    return onBlogTagView((view) => setText(view.label ?? title));
  }, [title]);

  return (
    <h1 className="text-heading-hero wrap-break-word text-text-base">
      <WordFade className="flex-wrap [&>span]:flex-wrap" text={text} />
    </h1>
  );
}
