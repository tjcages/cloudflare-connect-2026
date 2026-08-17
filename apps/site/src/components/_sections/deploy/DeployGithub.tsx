import cn from "classnames";
import Workers from "./_svg/Workers.svg?react";
import GithubLogo from "./_svg/GithubLogo.svg?react";
import VerticalDash from "./_svg/VerticalDash.svg?react";
import { useEffect, useRef, type RefObject } from "react";
import { animate } from "motion/react";
import { sleepVisible } from "@/utils/visibility-timers";
import DeployGithubArrow from "./Arrow";
import Icon from "@/components/icon/Icon";

async function arrowJump(
  badgeRef: RefObject<HTMLDivElement | null>,
  arrowRef: RefObject<HTMLDivElement | null>,
  wrapperRef: RefObject<HTMLDivElement | null>,
  delay: number
) {
  await Promise.all([
    animate(
      badgeRef.current,
      { scale: [1, 0.976, 1.014, 0.995, 1] },
      { duration: 0.45, ease: "linear" }
    ),
    animate(
      arrowRef.current,
      { x: [0, 70] },
      { duration: 1, delay: 0.2, ease: [0.6, 0.6, 0, 1] }
    ),
    animate(
      wrapperRef.current,
      { x: [0, 1.5, 0] },
      { duration: 0.5, delay, ease: [0.6, 0.6, 0, 1] }
    ),
  ]);
}

export default function DeployGithub() {
  const mainRef = useRef<HTMLDivElement>(null);
  const githubRef = useRef<HTMLDivElement>(null);
  const workersRef = useRef<HTMLDivElement>(null);
  const pulseRingRef = useRef<HTMLSpanElement>(null);
  const purpleArrowRef = useRef<HTMLDivElement>(null);
  const orangeArrowRef = useRef<HTMLDivElement>(null);
  const purpleArrowWrapperRef = useRef<HTMLDivElement>(null);
  const orangeArrowWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const root = mainRef.current;

    if (!root) return;

    const wait = (ms: number) =>
      sleepVisible(root, ms, { signal: controller.signal });

    async function loop() {
      while (!controller.signal.aborted) {
        if (!(await wait(2000))) return;

        await arrowJump(githubRef, purpleArrowRef, purpleArrowWrapperRef, 0.4);
        if (controller.signal.aborted || !(await wait(200))) return;

        await Promise.all([
          arrowJump(workersRef, orangeArrowRef, orangeArrowWrapperRef, 0.5),
          wait(550).then((completed) => {
            if (!completed) return;
            return animate(
              pulseRingRef.current,
              { scale: [1, 1.4], opacity: [1, 0] },
              { duration: 1, ease: [0.6, 0.6, 0, 1] }
            );
          }),
        ]);
      }
    }

    loop();

    return () => {
      controller.abort();
    };
  }, []);
  return (
    <div
      ref={mainRef}
      className="relative z-10 bg-background-base p-40 shadow-elevation-default"
    >
      <div className="relative mb-40 flex-center gap-16">
        <div className="p-12">
          <div
            ref={githubRef}
            className="flex-center size-56 rounded-full bg-background-base text-icon-base shadow-elevation-default"
          >
            <GithubLogo />
          </div>
        </div>

        <DeployGithubArrow
          ref={purpleArrowRef}
          wrapperRef={purpleArrowWrapperRef}
          lineClassName="bg-purple-900"
        />

        <div className="p-12">
          <div
            ref={workersRef}
            className="flex-center size-56 rounded-full shadow-elevation-default"
          >
            <Workers />
          </div>
        </div>

        <DeployGithubArrow
          ref={orangeArrowRef}
          wrapperRef={orangeArrowWrapperRef}
          lineClassName="bg-orange-900"
        />

        <div className="relative p-12">
          <span
            ref={pulseRingRef}
            className="absolute inset-12 rounded-full opacity-0 before:inside-border before:border-orange-900"
          />
          <div
            style={{
              background:
                "linear-gradient(180deg, rgba(235, 87, 41, 0.00) 60%, rgba(242, 124, 51, 0.24) 100%), linear-gradient(180deg, rgba(242, 124, 51, 0.24) 0%, rgba(235, 87, 41, 0.00) 40%), var(--color-orange-900)",
            }}
            className="flex-center size-56 rounded-full shadow-button-primary-rest"
          >
            <Icon name="cloudflare" className="h-20 w-30 text-icon-inverse" />
          </div>
        </div>
      </div>

      <div className="flex">
        {data.map((item, i) => (
          <div
            key={i}
            className="relative w-160 text-center text-body-x-small text-text-muted"
          >
            <VerticalDash className="absolute -top-34 left-1/2 -translate-x-1/2 text-border-dashed" />
            <span className={cn("text-label-x-small", item.className)}>
              {item.title}
            </span>
            <br />
            {item.description}
          </div>
        ))}
      </div>
    </div>
  );
}

const data = [
  { title: "GitHub", description: "Connect once", className: "text-text-base" },
  {
    title: "Workers",
    description: "Deploy automatically",
    className: "text-purple-900",
  },
  {
    title: "330+ Cities",
    description: "Run globally",
    className: "text-orange-900",
  },
];
