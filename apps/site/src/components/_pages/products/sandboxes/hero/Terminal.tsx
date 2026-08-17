import { AnimatePresence, motion } from "motion/react";

import HeroWindow from "@/components/HeroWindow";
import AnimatedHeight from "@/components/animated-size/AnimatedHeight";
import Icon from "@/components/icon/Icon";

import type { Act, Line } from "./acts";
import TerminalLine from "./TerminalLine";

export default function Terminal({
  act,
  printed,
  typing,
}: {
  act: Act;
  printed: number;
  typing: { index: number; chars: number } | null;
}) {
  const flat = act.blocks.flatMap((block, blockIndex) =>
    block.map((line) => ({ line, blockIndex }))
  );

  const shown = flat.slice(0, typing ? typing.index + 1 : printed);
  const groups: { blockIndex: number; lines: { line: Line; at: number }[] }[] =
    [];

  shown.forEach(({ line, blockIndex }, at) => {
    const last = groups.at(-1);
    if (last?.blockIndex === blockIndex) last.lines.push({ line, at });
    else groups.push({ blockIndex, lines: [{ line, at }] });
  });

  return (
    <HeroWindow variant="primary">
      <div className="absolute inset-x-0 top-0 h-56">
        <div className="absolute top-18 left-20 flex items-center gap-12">
          <Icon
            name="product-sandboxes"
            variant="duo"
            color="orange"
            size={20}
          />

          <span className="text-label-x-small text-text-base">Sandbox</span>
        </div>

        <div className="absolute top-16 right-20 flex items-center gap-2 rounded-full px-6 py-4 before:inside-border before:border-border-muted before:[transition:none]">
          <span className="flex-center size-16 shrink-0">
            <Icon
              name="3d-box-top"
              variant="duo"
              disabled
              size={14}
              className="[&_path]:stroke-[2.143]"
            />
          </span>

          <span className="px-4 text-body-tiny text-text-default">
            Isolated Environment
          </span>
        </div>
      </div>

      <div className="absolute top-56 left-20 h-324 w-440 before:inside-border before:border-border-default before:[transition:none]">
        <div className="relative flex h-48 items-center before:inner-border-b before:border-border-default before:[transition:none]">
          <span className="absolute top-16 left-16 flex-center h-16 w-40 gap-6">
            <span className="size-6 rounded-full bg-orange-900" />
            <span className="size-6 rounded-full bg-orange-800" />
            <span className="size-6 rounded-full bg-green-900" />
          </span>

          <span className="absolute top-12 left-1/2 flex h-24 -translate-x-1/2 items-center rounded-full bg-background-faint px-14">
            <span className="text-body-tiny whitespace-nowrap text-text-default">
              Worker ·{" "}
              <span className="text-label-tiny text-text-base">Sandbox</span>
            </span>
          </span>
        </div>

        <div className="relative flex h-206 items-end overflow-clip">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={act.id}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.165, 0.84, 0.44, 1] }}
              className="w-full"
            >
              <AnimatedHeight
                transition={{ duration: 0.12, ease: [0.165, 0.84, 0.44, 1] }}
              >
                <div className="flex flex-col items-start gap-21 p-24">
                  {groups.map((group) => (
                    <div
                      key={group.blockIndex}
                      className="flex flex-col items-start gap-4"
                    >
                      {group.lines.map(({ line, at }) => (
                        <TerminalLine
                          key={at}
                          line={line}
                          typed={
                            typing?.index === at ? typing.chars : undefined
                          }
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </AnimatedHeight>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-220 bg-linear-to-b from-transparent from-30% to-background-base" />
    </HeroWindow>
  );
}
