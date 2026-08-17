import { AnimatePresence, cubicBezier, motion } from "motion/react";
import Dropdown from "@/components/dropdown/Dropdown";
import DropdownCheckbox from "@/components/dropdown/DropdownCheckbox";
import Icon from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons.gen";

export default function FacetSelect({
  label,
  plural,
  icon,
  panelWidthClass,
  options,
  selected,
  onToggleValue,
}: {
  label: string;
  plural: string;
  icon: IconName;
  panelWidthClass: string;
  options: string[];
  selected: string[];
  onToggleValue: (value: string) => void;
}) {
  const triggerLabel =
    selected.length === 0
      ? label
      : selected.length === 1
        ? selected[0]
        : `${selected.length} ${plural}`;

  return (
    <Dropdown
      label={label}
      panelClassName={panelWidthClass}
      trigger={
        <button
          aria-label={
            selected.length > 0 ? `${label}: ${selected.join(", ")}` : label
          }
          className="group flex h-40 w-220 cursor-pointer items-center rounded-full bg-background-base p-10 shadow-select-rest transition-shadow outline-none hover:shadow-select-hover focus-visible:shadow-select-focus data-popup-open:shadow-select-active"
          type="button"
        >
          <Icon className="text-icon-muted" name={icon} size={20} />

          <span className="relative min-w-0 flex-1 px-6 text-left text-label-x-small text-text-base">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1 }}
                className="block truncate"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key={triggerLabel}
                transition={{
                  duration: 0.15,
                  ease: cubicBezier(0.165, 0.84, 0.44, 1),
                }}
              >
                {triggerLabel}
              </motion.span>
            </AnimatePresence>
          </span>

          <Icon
            className="text-icon-muted transition-transform group-data-popup-open:rotate-180"
            name="chevron-down-small"
            size={20}
          />
        </button>
      }
    >
      {options.map((value) => (
        <DropdownCheckbox
          checked={selected.includes(value)}
          key={value}
          onCheckedChange={() => onToggleValue(value)}
        >
          {value}
        </DropdownCheckbox>
      ))}
    </Dropdown>
  );
}
