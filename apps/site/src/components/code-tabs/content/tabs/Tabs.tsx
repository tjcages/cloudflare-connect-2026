import cn from "classnames";
import { animate } from "motion";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { resolveZoom } from "@/utils/zoom";
import type { DataProps } from "../data";

export default function CodeTabsContentTabs({
  activeTab,
  data,
  handleTabChange,
}: {
  activeTab: number;
  data: DataProps[];
  handleTabChange: (index: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scaleRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, width: 0 });

  useEffect(() => {
    const tabs = tabRefs.current[activeTab];
    const container = containerRef.current;

    if (!(tabs && container)) return;

    const zoom = resolveZoom(container);
    const tabsRect = tabs.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setPosition({
      x: (tabsRect.left - containerRect.left) / zoom,
      width: tabsRect.width / zoom,
    });
  }, [activeTab, data]);

  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % data.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + data.length) % data.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = data.length - 1;
    else return;

    event.preventDefault();
    handleTabChange(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="relative flex-center w-full py-20 before:inside-border-y before:border-border-default">
      <div
        aria-label="Code examples"
        className="relative flex gap-12"
        ref={containerRef}
        role="tablist"
      >
        {position.width > 0 && (
          <motion.div
            aria-hidden="true"
            animate={{
              x: position.x,
              width: position.width,
            }}
            className={cn(
              "absolute top-0 left-0 z-10 h-40 cursor-pointer rounded-full bg-orange-900 shadow-button-primary-rest",
              "transition-[scale] duration-200 active:duration-30",
              "hover:shadow-button-primary-hover focus-visible:shadow-button-primary-focus active:shadow-button-primary-pressed"
            )}
            initial={{ x: 0, width: position.width }}
            ref={scaleRef}
            transition={{
              duration: 0.45,
              ease: [0.6, 0.6, 0, 1],
            }}
          >
            <div className="overlay bg-linear-to-b from-orange-600 to-orange-900/0 to-40% opacity-24 transition-all duration-200 hover:opacity-32 active:opacity-8 active:duration-30 in-[button:focus-visible]:opacity-24" />
            <div className="overlay bg-linear-to-t from-orange-600 to-orange-900/0 to-40% opacity-24 transition-all duration-200 hover:opacity-32 active:opacity-8 active:duration-30 in-[button:focus-visible]:opacity-24" />
          </motion.div>
        )}

        {data.map((item, i) => (
          <button
            aria-controls="code-tabpanel"
            aria-selected={activeTab === i}
            className={cn(
              "relative cursor-pointer rounded-full p-10 px-16 text-label-x-small transition-colors duration-450",
              "before:absolute before:inset-0 before:z-0 before:rounded-full before:transition before:duration-450",

              activeTab === i
                ? "text-text-inverse"
                : "text-text-base hover:before:bg-background-faint"
            )}
            id={`code-tab-${i}`}
            key={i}
            onClick={() => {
              handleTabChange(i);
            }}
            onKeyDown={(event) => handleTabKeyDown(event, i)}
            role="tab"
            tabIndex={activeTab === i ? 0 : -1}
            type="button"
            onMouseDown={() => {
              if (i !== activeTab) return;

              animate(scaleRef.current, { scale: 0.95 });
            }}
            onMouseUp={() => {
              animate(scaleRef.current, { scale: 1 });
            }}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
          >
            <span className="relative z-20">{item.tabTitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
