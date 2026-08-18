import { cubicBezier, motion } from "motion/react";
import Icon from "@/components/icon/Icon";
import { productIcons, type Story } from "./data";

export default function StoryRow({ story }: { story: Story }) {
  return (
    <motion.div
      animate={{ opacity: 1, height: 72 }}
      className="flex flex-col justify-end overflow-clip"
      exit={{ opacity: 0, height: 0 }}
      initial={{ opacity: 0, height: 0 }}
      transition={{
        duration: 0.25,
        ease: cubicBezier(0.165, 0.84, 0.44, 1),
      }}
    >
      <a
        className="group relative flex h-72 shrink-0 items-center gap-8 bg-background-base px-80 max-lg:px-24 transition-colors duration-150 outline-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border-default hover:bg-background-surface focus-visible:shadow-[inset_0_0_0_2px_var(--color-orange-900)]"
        href={story.href}
      >
        <div className="flex w-248 items-center gap-20 max-lg:min-w-0 max-lg:flex-1">
          <story.logo aria-hidden className="size-20 shrink-0 text-icon-base" />

          <span className="min-w-0 flex-1 truncate text-label-x-small text-text-base">
            {story.company}
          </span>
        </div>

        <div className="flex w-372 items-center gap-20 max-lg:hidden">
          {story.products.slice(0, 2).map((product) => (
            <span className="flex items-center gap-6" key={product}>
              <Icon
                className="text-icon-muted"
                name={productIcons[product]}
                size={20}
              />

              <span className="text-body-x-small whitespace-nowrap text-text-default">
                {product}
              </span>
            </span>
          ))}

          {story.products.length > 2 && (
            <span className="text-body-x-small whitespace-nowrap text-text-subtle">
              +{story.products.length - 2} more
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-10 pr-32 text-body-x-small max-lg:hidden">
          <span className="whitespace-nowrap text-text-muted">
            {story.industry}
          </span>

          <span className="text-text-faint">·</span>

          <span className="min-w-0 flex-1 truncate text-text-muted">
            {story.region}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <span className="text-label-x-small whitespace-nowrap text-text-base transition-colors duration-150 group-hover:text-orange-900">
            Read story
          </span>

          <Icon
            className="text-icon-base transition-all duration-150 group-hover:translate-x-2 group-hover:text-orange-900"
            name="arrow-right"
            size={20}
          />
        </div>
      </a>
    </motion.div>
  );
}
