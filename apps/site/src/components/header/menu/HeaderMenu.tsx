import { AnimatePresence, cubicBezier, motion } from "motion/react";
import { useState } from "react";
import HeaderMenuBanner from "./HeaderMenuBanner";
import HeaderMenuFooter from "./HeaderMenuFooter";
import HeaderMenuSidebar from "./HeaderMenuSidebar";

export interface IHeaderMenu {
  groups: { label: string }[];
  seeAllLabel: string;
  seeAllHref?: string;
  banner?: boolean;
  footer?: boolean;
  renderContent: (activeIndex: number, direction: 1 | -1) => React.ReactNode;
}

type HeaderMenuProps = {
  menuKey: string;
  direction: 1 | -1;
  menu: IHeaderMenu;
};

export default function HeaderMenu({
  menuKey,
  direction: menuDirection,
  menu,
}: HeaderMenuProps) {
  const [activeState, setActiveState] = useState<{
    menuKey: string;
    index: number;
    direction: 1 | -1;
  }>({ menuKey, index: 0, direction: menuDirection });

  if (activeState.menuKey !== menuKey) {
    setActiveState({ menuKey, index: 0, direction: menuDirection });
  }

  const isSameMenu = activeState.menuKey === menuKey;
  const activeIndex = isSameMenu ? activeState.index : 0;
  const direction = isSameMenu ? activeState.direction : menuDirection;

  return (
    <>
      <div className="relative flex">
        <HeaderMenuSidebar
          activeIndex={activeIndex}
          direction={direction}
          groups={menu.groups}
          menuKey={menuKey}
          onActiveIndexChange={(index) =>
            setActiveState({ menuKey, index, direction: -1 })
          }
          seeAllHref={menu.seeAllHref}
          seeAllLabel={menu.seeAllLabel}
        />

        <div className="relative flex flex-1 flex-col before:inside-border-l before:border-border-default">
          {menu.renderContent(activeIndex, direction)}

          <AnimatePresence initial={false} mode="popLayout">
            {menu.banner && (
              <motion.div
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="banner"
                transition={{
                  duration: 0.25,
                  ease: cubicBezier(0.165, 0.84, 0.44, 1),
                }}
              >
                <HeaderMenuBanner />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {menu.footer && (
          <motion.div
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="footer"
            transition={{
              duration: 0.25,
              ease: cubicBezier(0.165, 0.84, 0.44, 1),
            }}
          >
            <HeaderMenuFooter />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
