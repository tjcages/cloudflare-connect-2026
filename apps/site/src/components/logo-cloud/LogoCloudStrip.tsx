import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import DashedLine from "@/components/dashed-line/DashedLine";
import LogoAnthropic from "./_svg/logo-anthropic.svg?react";
import LogoDiscord from "./_svg/logo-discord.svg?react";
import LogoDoordash from "./_svg/logo-doordash.svg?react";
import LogoLovable from "./_svg/logo-lovable.svg?react";
import LogoOpenai from "./_svg/logo-openai.svg?react";
import LogoShopify from "./_svg/logo-shopify.svg?react";
import LogoUber from "./_svg/logo-uber.svg?react";

const logos = [
  { label: "Shopify", Logo: LogoShopify, href: "/case-studies/shopify" },
  { label: "Discord", Logo: LogoDiscord, href: "/case-studies/discord" },
  { label: "OpenAI", Logo: LogoOpenai },
  { label: "Lovable", Logo: LogoLovable },
  { label: "Anthropic", Logo: LogoAnthropic },
  { label: "Uber", Logo: LogoUber },
  { label: "DoorDash", Logo: LogoDoordash },
];

const CELL_COUNT = logos.length * 2;
const BASE_VELOCITY = -40;

type LogoCloudStripProps = {
  variant?: "default" | "pages";
  dividers?: boolean;
};

export default function LogoCloudStrip({
  variant = "default",
  dividers = true,
}: LogoCloudStripProps) {
  const cellWidth = variant === "pages" ? 300 : 200;
  const setWidth = logos.length * cellWidth;
  const initialOffset = variant === "pages" ? -600 : -100;
  const cellClassName =
    variant === "pages" ? "relative w-300" : "relative w-200";
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<{
    hovered: number | null;
    reference: number;
  }>({ hovered: null, reference: 0 });
  const motion = useRef({
    offset: initialOffset,
    velocity: BASE_VELOCITY,
    baseVelocity: BASE_VELOCITY,
    pointerId: -1,
    dragging: false,
    suppressClick: false,
    pointerInside: false,
    pointerX: 0,
    wrapperLeft: 0,
    startX: 0,
    lastX: 0,
    lastMoveTime: 0,
    sampledVelocity: 0,
  });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const strip = stripRef.current;
    if (!wrapper || !strip) return;

    const m = motion.current;
    m.offset = initialOffset;
    let frame = 0;
    let lastTime = 0;

    const applyHover = (index: number | null) => {
      setHoverState((prev) =>
        prev.hovered === index
          ? prev
          : { hovered: index, reference: index ?? prev.reference }
      );
    };

    const tick = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (!m.dragging) {
        const target = m.pointerInside ? 0 : m.baseVelocity;
        const tau = Math.abs(m.velocity) > Math.abs(m.baseVelocity) ? 0.8 : 0.2;
        m.velocity += (target - m.velocity) * (1 - Math.exp(-dt / tau));
        m.offset += m.velocity * dt;
      }
      while (m.offset <= -setWidth) m.offset += setWidth;
      while (m.offset > 0) m.offset -= setWidth;
      strip.style.transform = `translateX(${m.offset}px)`;

      if (m.pointerInside && !m.dragging) {
        const zoom = wrapper.currentCSSZoom ?? 1;
        const x = (m.pointerX - m.wrapperLeft) / zoom - m.offset;
        applyHover(
          Math.min(Math.max(Math.floor(x / cellWidth), 0), CELL_COUNT - 1)
        );
      } else {
        applyHover(null);
      }

      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(frame);
      if (entry.isIntersecting) {
        lastTime = performance.now();
        frame = requestAnimationFrame(tick);
      }
    });
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [cellWidth, initialOffset, setWidth]);

  const onPointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    m.pointerInside = true;
    m.pointerX = event.clientX;
    m.wrapperLeft = event.currentTarget.getBoundingClientRect().left;
  };

  const onPointerLeave = () => {
    motion.current.pointerInside = false;
    setHoverState((prev) =>
      prev.hovered === null
        ? prev
        : { hovered: null, reference: prev.reference }
    );
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const m = motion.current;
    m.pointerId = event.pointerId;
    m.dragging = false;
    m.suppressClick = false;
    m.startX = event.clientX;
    m.lastX = event.clientX;
    m.lastMoveTime = event.timeStamp;
    m.sampledVelocity = 0;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    m.pointerX = event.clientX;
    if (m.pointerId !== event.pointerId) return;

    if (!m.dragging) {
      if (Math.abs(event.clientX - m.startX) < 6) return;
      m.dragging = true;
      m.suppressClick = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.dragging = "";
      m.lastX = event.clientX;
      m.lastMoveTime = event.timeStamp;
      return;
    }

    if (event.pointerType === "mouse" && event.buttons === 0) {
      finishDrag(event.currentTarget);
      return;
    }

    const zoom = event.currentTarget.currentCSSZoom ?? 1;
    const dx = (event.clientX - m.lastX) / zoom;
    const dt = (event.timeStamp - m.lastMoveTime) / 1000;
    m.offset += dx;
    if (dt > 0) {
      const instant = dx / dt;
      m.sampledVelocity +=
        (instant - m.sampledVelocity) * Math.min(dt / 0.05, 1);
    }
    m.lastX = event.clientX;
    m.lastMoveTime = event.timeStamp;
  };

  const finishDrag = (wrapper: HTMLDivElement) => {
    const m = motion.current;
    m.pointerId = -1;
    if (!m.dragging) return;
    m.dragging = false;
    delete wrapper.dataset.dragging;
    m.velocity = Math.max(-3200, Math.min(3200, m.sampledVelocity));
    if (Math.abs(m.velocity) > 1) {
      m.baseVelocity = Math.sign(m.velocity) * Math.abs(BASE_VELOCITY);
    }
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (motion.current.pointerId !== event.pointerId) return;
    finishDrag(event.currentTarget);
  };

  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const m = motion.current;
    if (!m.suppressClick) return;
    m.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={wrapperRef}
      className="group h-full cursor-grab touch-pan-y overflow-x-clip select-none data-dragging:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onClickCapture={onClickCapture}
    >
      <div
        ref={stripRef}
        className="flex h-full w-max will-change-transform"
        style={{ transform: `translateX(${initialOffset}px)` }}
      >
        {[...logos, ...logos].map(({ label, Logo, href }, index) => {
          const hoveredIsLink =
            hoverState.hovered !== null &&
            Boolean(logos[hoverState.hovered % logos.length].href);
          const duplicate = index >= logos.length;
          const key = `${label}-${duplicate ? "b" : "a"}`;
          const away = Math.abs(index - hoverState.reference);
          const distance = Math.min(away, CELL_COUNT - away);
          const dimmed = hoveredIsLink && index !== hoverState.hovered;
          const logoClassName =
            variant === "pages" && label === "OpenAI"
              ? "translate-y-2"
              : undefined;
          const cellStyle = {
            transitionDelay: `${Math.max(0, distance - 1) * 40}ms`,
          };

          if (!href) {
            return (
              <div
                key={key}
                aria-hidden={duplicate || undefined}
                aria-label={duplicate ? undefined : label}
                className={cn(
                  "flex-center h-full shrink-0 transition-opacity duration-300 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
                  cellClassName,
                  dimmed && "opacity-40"
                )}
                role={duplicate ? undefined : "img"}
                style={cellStyle}
              >
                {dividers && (
                  <DashedLine
                    className="absolute -inset-y-0.5 -left-0.5 text-border-dashed"
                    direction="vertical"
                  />
                )}
                <Logo className={logoClassName} />
              </div>
            );
          }

          return (
            <a
              key={key}
              aria-hidden={duplicate || undefined}
              aria-label={duplicate ? undefined : `${label} case study`}
              className={cn(
                "flex-center h-full shrink-0 cursor-pointer transition-opacity duration-300 ease-[cubic-bezier(0.165,0.84,0.44,1)] group-data-dragging:cursor-grabbing focus-visible:shadow-[inset_0_0_0_2px_var(--color-orange-900)] focus-visible:outline-none",
                cellClassName,
                dimmed && "opacity-40"
              )}
              draggable={false}
              href={href}
              style={cellStyle}
              tabIndex={duplicate ? -1 : undefined}
            >
              {dividers && (
                <DashedLine
                  className="absolute -inset-y-0.5 -left-0.5 text-border-dashed"
                  direction="vertical"
                />
              )}
              <Logo aria-hidden className={logoClassName} />
            </a>
          );
        })}
      </div>
    </div>
  );
}
