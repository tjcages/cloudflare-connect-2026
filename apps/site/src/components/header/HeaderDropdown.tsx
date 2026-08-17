import { AnimatePresence, cubicBezier, motion } from "motion/react";
import { useEffect } from "react";
import AnimatedHeight from "@/components/animated-size/AnimatedHeight";
import CornerDots from "@/components/CornerDots";
import DashedLineBleed from "@/components/DashedLineBleed";
import HeaderMenu, { type IHeaderMenu } from "./menu/HeaderMenu";

interface IHeaderDropdown {
  label: string;
  direction: 1 | -1;
  menu: IHeaderMenu;
  panelRef: React.Ref<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function HeaderDropdown({
  label,
  direction,
  menu,
  panelRef,
  onMouseEnter,
  onMouseLeave,
}: IHeaderDropdown) {
  useEffect(() => {
    document.body.classList.add("overflow-hidden");

    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, []);

  return (
    <motion.div className="absolute top-full centering-w-[100vw] z-11 h-screen">
      <div
        className="absolute inset-x-0 -top-24 h-24"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />

      <motion.div
        animate={{ opacity: 1 }}
        className="overlay bg-overlay-darker-default backdrop-blur-[16px] backdrop-grayscale"
        exit={{
          opacity: 0,
          transition: {
            duration: 0.3,
            ease: cubicBezier(0.165, 0.84, 0.44, 1),
          },
        }}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: cubicBezier(0.6, 0.6, 0, 1) }}
      />

      <motion.div
        animate={{ clipPath: "inset(0 0 0% 0)" }}
        className="relative z-11 -mt-12 pt-12"
        exit={{
          clipPath: "inset(0 0 100% 0)",
          transition: {
            duration: 0.3,
            ease: cubicBezier(0.165, 0.84, 0.44, 1),
          },
        }}
        id="header-dropdown-panel"
        initial={{ clipPath: "inset(0 0 100% 0)" }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        ref={panelRef}
        transition={{ duration: 0.35, ease: cubicBezier(0.6, 0.6, 0, 1) }}
      >
        <div className="bg-background-base">
          <div className="relative mx-auto max-w-1200 before:inside-border-x before:border-border-default">
            <CornerDots accentClassName="bg-green-900" count={4} />

            <AnimatePresence initial={false}>
              {menu.footer && (
                <motion.div
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="footer-bleed"
                  transition={{
                    duration: 0.25,
                    ease: cubicBezier(0.165, 0.84, 0.44, 1),
                  }}
                >
                  <DashedLineBleed className="bottom-80" />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatedHeight
              transition={{
                duration: 0.35,
                ease: cubicBezier(0.165, 0.84, 0.44, 1),
              }}
            >
              <HeaderMenu direction={direction} menu={menu} menuKey={label} />
            </AnimatedHeight>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
