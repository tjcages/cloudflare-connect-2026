import { BUILTIN_PRESETS } from "../presets/builtinPresets";
import { useAppStore } from "../store";
import { ComponentListItem } from "./ComponentListItem";
import { SectionHeading } from "./SectionHeading";
import { useScrollbarThumbFlash } from "./useScrollbarThumbFlash";

export const PresetsSidebar = () => {
  const scrollThumbFlash = useScrollbarThumbFlash();
  const applyBuilderDocumentSnapshot = useAppStore((s) => s.applyBuilderDocumentSnapshot);

  return (
    <div className="component-sidebar">
      <section className="component-section">
        <SectionHeading title="Presets" />
        <div className="component-scroll-region ui-scroll-overlay" onScroll={scrollThumbFlash}>
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
