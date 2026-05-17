import { BUILTIN_PRESETS } from "../presets/builtinPresets";
import { useAppStore } from "../store";
import { ComponentListItem } from "./ComponentListItem";
import { SectionHeading } from "./SectionHeading";
import { useScrollbarThumbFlash } from "./useScrollbarThumbFlash";

export const PresetsSidebar = () => {
  const scrollThumbFlash = useScrollbarThumbFlash();
  const applyBuilderDocumentSnapshot = useAppStore((s) => s.applyBuilderDocumentSnapshot);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <section className="flex min-h-[50vh] flex-col gap-0 py-3.5">
        <SectionHeading title="Presets" />
        <div
          className="ui-scroll-overlay grid min-h-0 flex-1 auto-rows-min content-start gap-0 overflow-auto"
          onScroll={scrollThumbFlash}
        >
          {BUILTIN_PRESETS.map((preset) => (
            <ComponentListItem
              key={preset.id}
              as="button"
              testId={`preset-item-${preset.id}`}
              title={preset.label}
              onClick={() => {
                applyBuilderDocumentSnapshot(preset.snapshot);
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
