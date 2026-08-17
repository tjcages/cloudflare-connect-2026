import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";
import DeployListItem from "./item/Item";
import type { Version } from "./types";
import { addQueuedItem, openDropdownOnRandomItem } from "./utils";
import DeployListItemDropdown from "./item/dropdown/Dropdown";
import { setIntervalOnVisible, sleepVisible } from "@/utils/visibility-timers";
import { initialData } from "./constants";

export default function DeployList() {
  const mainRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState(initialData);
  const listRef = useRef(initialData);
  const versionRef = useRef<Version>(initialData[0].version);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setIntervalOnVisible({
      element: mainRef.current,
      interval: 1000,
      callback: () => {
        setList((prev) =>
          prev.map((item) =>
            item.status === "Building"
              ? { ...item, duration: item.duration + 1 }
              : item
          )
        );
      },
    });

    return interval.cleanup;
  }, []);

  useEffect(() => {
    listRef.current = list;
  }, [list]);

  useEffect(() => {
    const controller = new AbortController();
    const root = mainRef.current;

    if (!root) return;

    const wait = (ms: number) =>
      sleepVisible(root, ms, { signal: controller.signal });

    async function run() {
      while (!controller.signal.aborted) {
        const buildTime = Math.floor(Math.random() * 10000) + 10000;

        if (!(await wait(buildTime / 4))) return;
        addQueuedItem(setList, versionRef);

        if (!(await wait(2000))) return;
        openDropdownOnRandomItem(listRef.current, setOpenDropdownId);

        if (!(await wait(buildTime / 2))) return;
        setOpenDropdownId(null);

        if (!(await wait(2000))) return;
        setList((prev) =>
          prev.map((item) =>
            item.status === "Building"
              ? { ...item, status: "Deployed" as const }
              : item
          )
        );

        if (!(await wait(2000))) return;
        setList((prev) =>
          prev.map((item) =>
            item.status === "Queued"
              ? { ...item, status: "Building" as const, duration: 0 }
              : item
          )
        );
      }
    }

    run();

    return () => {
      controller.abort();
    };
  }, []);

  const activeItem = list.find(
    (item) => item.id === openDropdownId && item.status === "Deployed"
  );

  const activeIndex = list.findIndex((item) => item.id === openDropdownId);

  return (
    <div
      ref={mainRef}
      className="relative z-10 h-320 w-full bg-background-base shadow-elevation-default"
    >
      <div className="relative h-full overflow-hidden">
        <AnimatePresence initial={false}>
          {list.map((item, i) => (
            <DeployListItem
              key={item.id}
              {...item}
              index={i}
              active={openDropdownId === item.id}
            />
          ))}
        </AnimatePresence>
      </div>

      <DeployListItemDropdown
        activeIndex={activeIndex}
        activeItem={activeItem}
      />
    </div>
  );
}
