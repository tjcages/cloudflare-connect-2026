import cn from "classnames";
import { AnimatePresence, cubicBezier, motion } from "motion/react";
import { useRef } from "react";
import { useBoolean, useCopyToClipboard, useTimeout } from "usehooks-ts";
import Dropdown from "../dropdown/Dropdown";
import DropdownItem from "../dropdown/DropdownItem";
import DropdownLink from "../dropdown/DropdownLink";
import DropdownSeparator from "../dropdown/DropdownSeparator";
import Icon from "../icon/Icon";
import type { IconName } from "../icon/icons.gen";
import Logo from "../logo/Logo.svg?react";
import logoSvg from "../logo/Logo.svg?raw";

function Item({
  icon,
  label,
  href,
  onClick,
  accent,
}: {
  icon: IconName;
  label: string;
  href?: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  const content = (
    <>
      <span className="relative flex shrink-0">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className="flex"
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            key={icon}
            transition={{
              duration: 0.25,
              ease: cubicBezier(0.165, 0.84, 0.44, 1),
            }}
          >
            <Icon
              className={
                accent
                  ? "text-orange-900"
                  : "text-icon-default transition-all group-hover:text-icon-base"
              }
              name={icon}
              size={20}
            />
          </motion.span>
        </AnimatePresence>
      </span>

      <span className="relative flex">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, y: 0 }}
            className={cn("whitespace-nowrap", accent && "text-orange-900")}
            exit={{ opacity: 0, y: -6 }}
            initial={{ opacity: 0, y: 6 }}
            key={label}
            transition={{
              duration: 0.25,
              ease: cubicBezier(0.165, 0.84, 0.44, 1),
              delay: 0.05,
            }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
    </>
  );

  if (href !== undefined) {
    return (
      <DropdownLink className="group w-full gap-12" href={href}>
        {content}
      </DropdownLink>
    );
  }

  return (
    <DropdownItem
      className="group w-full gap-12"
      closeOnClick={false}
      onClick={onClick}
    >
      {content}
    </DropdownItem>
  );
}

export default function HeaderLogo() {
  const open = useBoolean(false);
  const copied = useBoolean(false);
  const [, copy] = useCopyToClipboard();
  const logoRef = useRef<HTMLAnchorElement>(null);

  useTimeout(copied.setFalse, copied.value ? 1200 : null);

  const copyLogo = async () => {
    copied.setValue(await copy(logoSvg));
  };

  return (
    <div
      className="flex"
      onContextMenu={(event) => {
        event.preventDefault();
        open.toggle();
      }}
    >
      <a aria-label="Cloudflare home" className="flex" href="/" ref={logoRef}>
        <Logo />
      </a>

      <Dropdown
        anchor={logoRef}
        finalFocus={logoRef}
        label="Cloudflare logo"
        onOpenChange={open.setValue}
        open={open.value}
        panelClassName="w-232"
      >
        <Item
          accent={copied.value}
          icon={copied.value ? "checkmark-1-medium" : "cloudflare"}
          label={copied.value ? "Copied" : "Copy logo as SVG"}
          onClick={copyLogo}
        />

        <DropdownSeparator />

        <Item href="#" icon="arrow-inbox" label="Download Media Kit" />

        <Item href="#" icon="newspaper-2" label="Visit Press" />
      </Dropdown>
    </div>
  );
}
