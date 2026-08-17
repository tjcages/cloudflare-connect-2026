import { useEffect, useRef, useState } from "react";
import DottedLink from "@/components/DottedLink";
import CodeTabsContentHighlighter from "./highlighter/Highlighter";
import CodeTabsContentTabs from "./tabs/Tabs";
import {
  AnimatePresence,
  cubicBezier,
  motion,
  type Variants,
} from "motion/react";
import { animate, scrambleText } from "animejs";
import type { DataProps } from "./data";

const copyVariants = (
  index: number,
  direction: number,
  xMultiplier = 1
): Variants => ({
  hidden: {
    x: -16 * direction * xMultiplier,
    opacity: 0,
    filter: "blur(1px)",
  },
  visible: {
    x: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.25,
      ease: cubicBezier(0.165, 0.84, 0.44, 1),
      delay: 0.03 + index * 0.04,
    },
  },
  exit: (exitDirection: number) => ({
    x: 16 * exitDirection * xMultiplier,
    opacity: 0,
    filter: "blur(1px)",
    transition: {
      duration: 0.25,
      ease: cubicBezier(0.165, 0.84, 0.44, 1),
      delay: index * 0.04,
    },
  }),
});

export default function CodeTabsContent({
  items,
}: {
  items: (DataProps & { html: string })[];
}) {
  const [activeTab, setActiveTab] = useState(0);
  const activeItem = items[activeTab];
  const [direction, setDirection] = useState(0);
  const numberRef = useRef<HTMLDivElement>(null);

  function handleTabChange(index: number) {
    setDirection(index > activeTab ? 1 : -1);
    setActiveTab(index);
  }

  useEffect(() => {
    if (!numberRef.current) return;

    const animation = animate(numberRef.current, {
      innerHTML: scrambleText({
        text: `0${activeTab + 1}`,
        revealRate: 120,
        duration: 450,
        settleRate: 60,
      }),
      ease: cubicBezier(0.6, 0.6, 0, 1),
    });

    return () => {
      animation.cancel();
    };
  }, [activeTab]);

  return (
    <>
      <CodeTabsContentTabs
        activeTab={activeTab}
        data={items}
        handleTabChange={handleTabChange}
      />

      <div
        aria-labelledby={`code-tab-${activeTab}`}
        className="relative flex before:inside-border-b before:border-border-default"
        id="code-tabpanel"
        role="tabpanel"
        tabIndex={0}
      >
        <div className="relative flex min-w-0 shrink grow basis-640 flex-col overflow-clip p-80">
          <div className="text-decorative-small text-text-subtle">
            CODE · <span className="text-orange-900" ref={numberRef} />
          </div>

          <div className="flex-1" />

          <AnimatePresence custom={direction} initial={false} mode="popLayout">
            <motion.div key={activeTab}>
              <motion.div
                variants={copyVariants(0, direction, 0.5)}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="mb-24 max-w-360 text-heading-h4 text-text-base"
              >
                {activeItem.title}
              </motion.div>

              <motion.div
                variants={copyVariants(1, direction)}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="max-w-440 text-body-large text-text-default"
              >
                {activeItem.description}
                {activeItem.docsHref && (
                  <>
                    {" "}
                    <DottedLink href={activeItem.docsHref}>See docs</DottedLink>
                  </>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        <CodeTabsContentHighlighter
          code={activeItem.code}
          direction={direction}
          html={activeItem.html}
          fileName={activeItem.fileName}
          language={activeItem.language}
          terminalLabel={activeItem.terminalLabel}
        />
      </div>
    </>
  );
}
