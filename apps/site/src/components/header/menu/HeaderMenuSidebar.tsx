import { AnimatePresence, cubicBezier, motion } from "motion/react";
import Button from "@/components/Button";
import CategoryList from "@/components/category-list/CategoryList";
import Icon from "@/components/icon/Icon";

type HeaderMenuSidebarProps = {
  menuKey: string;
  direction: 1 | -1;
  groups: { label: string }[];
  seeAllLabel: string;
  seeAllHref?: string;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
};

export default function HeaderMenuSidebar({
  menuKey,
  direction,
  groups,
  seeAllLabel,
  seeAllHref,
  activeIndex,
  onActiveIndexChange,
}: HeaderMenuSidebarProps) {
  return (
    <div className="relative flex w-300 flex-col gap-4 p-40 contain-paint">
      <div className="mb-12 px-12 text-body-x-small text-text-muted">
        Browse by category
      </div>

      <AnimatePresence custom={direction} initial={false} mode="popLayout">
        <motion.div
          animate="visible"
          exit="exit"
          initial="hidden"
          key={menuKey}
        >
          <CategoryList
            activeIndex={activeIndex}
            items={groups.map((group) => ({
              key: group.label,
              label: group.label,
            }))}
            onSelect={onActiveIndexChange}
            rowVariants={(index) => ({
              hidden: {
                x: 4 * direction,
                opacity: 0,
                filter: "blur(1px)",
              },
              visible: {
                x: 0,
                opacity: 1,
                filter: "blur(0px)",
                transition: {
                  duration: 0.22,
                  ease: cubicBezier(0.165, 0.84, 0.44, 1),
                  delay: 0.015 + index * 0.04,
                },
              },
              exit: (rowDirection: number) => ({
                x: -4 * rowDirection,
                opacity: 0,
                filter: "blur(1px)",
                transition: {
                  duration: 0.18,
                  ease: cubicBezier(0.165, 0.84, 0.44, 1),
                  delay: index * 0.04,
                },
              }),
            })}
          />
        </motion.div>
      </AnimatePresence>

      <div className="flex-1" />

      <div className="grid *:col-start-1 *:row-start-1">
        <AnimatePresence custom={direction} initial={false}>
          <motion.div
            animate="visible"
            exit="exit"
            initial="hidden"
            key={menuKey}
            variants={{
              hidden: {
                x: 4 * direction,
                opacity: 0,
                filter: "blur(1px)",
              },
              visible: {
                x: 0,
                opacity: 1,
                filter: "blur(0px)",
                transition: {
                  duration: 0.22,
                  ease: cubicBezier(0.165, 0.84, 0.44, 1),
                  delay: 0.015 + groups.length * 0.04,
                },
              },
              exit: (buttonDirection: number) => ({
                x: -4 * buttonDirection,
                opacity: 0,
                filter: "blur(1px)",
                transition: {
                  duration: 0.18,
                  ease: cubicBezier(0.165, 0.84, 0.44, 1),
                  delay: groups.length * 0.04,
                },
              }),
            }}
          >
            <Button
              className="w-full justify-between!"
              href={seeAllHref ?? "#"}
              variant="ghost"
            >
              <span>{seeAllLabel}</span>
              <Icon name="arrow-right" />
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
