import { AnimatePresence, motion } from "motion/react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import SnakeField, { type SnakeFieldHandle } from "./SnakeField";
import {
  createLoopedAnimation,
  type LoopedAnimationContext,
} from "@/utils/looped-animation";
import { resolveZoom } from "@/utils/zoom";
import { nanoid } from "nanoid";
import { nudgeHit } from "@/components/_animations/shared/nudge/nudge-hit";
import MethodBadge from "@/components/MethodBadge";
import type { BrowserVariant } from "@/components/browser/types";
import cn from "classnames";
import RequestsBrowser from "./Browser";

export type CardAnimationContext = LoopedAnimationContext & {
  card: () => HTMLDivElement | null;
};

export default function CarouselCardRequests({
  title,
  children,
  lastChildren,
  startAnimation,
  flash,
  overlay,
  variant,
  loading,
  returnDelay = 500,
  setFinish,
}: {
  title: string;
  children: React.ReactNode;
  lastChildren?: React.ReactNode;
  startAnimation: (context: CardAnimationContext) => Promise<void>;
  flash?: React.ReactNode;
  overlay?: React.ReactNode;
  variant: BrowserVariant;
  loading?: boolean;
  /** Hold between the card finishing and the snake going back. */
  returnDelay?: number;
  setFinish?: Dispatch<SetStateAction<boolean>>;
}) {
  const shotBadgeRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState(
    Array.from({ length: 3 }, (_, i) => ({ id: `${i + 1}` }))
  );
  const [enabled, setEnabled] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  const fieldRef = useRef<SnakeFieldHandle>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<HTMLDivElement>(null);

  const throwSnake = (reverse?: boolean, onArrive?: () => void) => {
    const root = rootRef.current;
    const pill = shotBadgeRef.current;
    const card = activeCard() ?? reelRef.current;
    if (!root || !pill || !card) return;

    const zoom = resolveZoom(root);
    const origin = root.getBoundingClientRect().top;
    const local = (edge: number) => (edge - origin) / zoom;
    const pillBox = pill.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();

    const pillMid = local((pillBox.top + pillBox.bottom) / 2);
    const cardMid = local((cardBox.top + cardBox.bottom) / 2);
    const span = cardMid - pillMid;
    if (span <= 0) return;

    const x = root.clientWidth / 2;

    return fieldRef.current?.throw({
      from: { x, y: reverse ? cardMid : pillMid },
      to: { x, y: reverse ? pillMid : cardMid },
      root,
      arrive: reverse
        ? (cardMid - local(pillBox.bottom)) / span
        : (local(cardBox.top) - pillMid) / span,
      onArrive,
      color: "blue",
    });
  };

  const startAnimationEffect = useEffectEvent((context: CardAnimationContext) =>
    startAnimation(context)
  );

  const activeCard = () =>
    rootRef.current?.querySelector<HTMLDivElement>("[data-card-active]") ??
    null;

  const hitCard = () => {
    const card = activeCard();
    if (card) nudgeHit(card, { axis: "y", amount: 1.5 });
  };

  const landing = () => {
    let land = () => {};
    const landed = new Promise<void>((resolve) => {
      land = resolve;
    });
    return {
      landed,
      onArrive: () => {
        hitCard();
        setEnabled(true);
        land();
      },
    };
  };

  const hitPill = () => {
    if (shotBadgeRef.current)
      nudgeHit(shotBadgeRef.current, { axis: "y", amount: -1.5 });
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    return createLoopedAnimation(async ({ sleep }) => {
      await sleep(500 + Math.random() * 1000);

      const arrival = landing();
      throwSnake(false, arrival.onArrive);

      await Promise.race([arrival.landed, sleep(1500)]);

      await startAnimationEffect({ sleep, card: activeCard });

      await sleep(returnDelay);

      throwSnake(true, hitPill);

      await sleep(800);

      setEnabled(false);
      setList((prev) => [...prev.slice(1), { id: nanoid() }]);

      await sleep(300);

      setFinish?.(false);
    }, root);
  }, []);

  return (
    <div className="relative pt-24" ref={rootRef}>
      <Corners />

      <div className="absolute top-0 left-1/2 z-5 h-full w-1 bg-border-default" />

      <SnakeField className="absolute inset-0 z-9" ref={fieldRef} />
      <motion.div
        ref={shotBadgeRef}
        initial={{ y: 0 }}
        className="relative z-10 mx-auto flex w-max gap-8 rounded-full bg-background-base p-6 pr-13 shadow-elevation-default"
      >
        <MethodBadge variant="faint" method="POST"></MethodBadge>

        <div className="text-mono-x-small text-text-base">/{title}</div>
      </motion.div>

      <div className="relative">
        {lastChildren}

        <div
          className="relative z-10 flex h-184 items-center justify-center overflow-hidden"
          ref={reelRef}
        >
          <AnimatePresence>
            {list.map((card, i) => (
              <motion.div
                key={card.id}
                initial={
                  isFirstRender.current
                    ? false
                    : {
                        x: i * 260,
                      }
                }
                animate={{
                  x: (i - 1) * 260,
                }}
                transition={{
                  duration: 0.35,
                  ease: [0.6, 0.6, 0, 1],
                }}
                className="absolute"
              >
                <RequestsBrowser
                  variant={variant}
                  loading={loading}
                  flash={flash}
                  overlay={overlay}
                  active={i === 1}
                  enabled={i === 1 && enabled}
                >
                  {children}
                </RequestsBrowser>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Corners() {
  return (
    <>
      {[
        ["-left-6 -top-6", ""],
        ["-right-6 -top-6", "rotate-90"],
        ["-right-6 -bottom-6", "rotate-180"],
        ["-left-6 -bottom-6", "-rotate-90"],
      ].map(([position, rotation], i) => (
        <div
          key={i}
          className={cn([
            position,
            "absolute z-30 size-12 rounded-full bg-background-base",
          ])}
        >
          <svg
            className={cn([rotation, "size-full overflow-visible"])}
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              className="stroke-border-muted"
              d="M12 6A6 6 0 0 1 6 12"
              strokeLinecap="square"
            />
          </svg>

          <div className="absolute centering-size-2 rounded-full bg-orange-900" />
        </div>
      ))}
    </>
  );
}
