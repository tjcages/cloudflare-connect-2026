import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import {
  cloneTwizzlerControlSettings,
  resolveConnectTwizzlerSettings,
  type TwizzlerControlSettings,
} from "../hero/twizzler-control-settings";

export const AGENDA_TWIZZLER_TARGETS = [
  {
    id: "agenda-mon",
    label: "Agenda · Mon Oct 19",
    panelId: "connect-agenda-mon-twizzler-v1",
  },
  {
    id: "agenda-tue",
    label: "Agenda · Tue Oct 20",
    panelId: "connect-agenda-tue-twizzler-v1",
  },
  {
    id: "agenda-wed",
    label: "Agenda · Wed Oct 21",
    panelId: "connect-agenda-wed-twizzler-v1",
  },
] as const;

export type AgendaTwizzlerTarget =
  (typeof AGENDA_TWIZZLER_TARGETS)[number]["id"];

export type AgendaTwizzlerSettingsEvent = {
  target: AgendaTwizzlerTarget;
  settings: TwizzlerSettings;
};

export const AGENDA_TWIZZLER_SETTINGS_EVENT =
  "connect:agenda-twizzler-settings";

export const AGENDA_TWIZZLER_CONTROL_DEFAULTS = Object.fromEntries(
  AGENDA_TWIZZLER_TARGETS.map(({ id }) => [id, cloneTwizzlerControlSettings()])
) as Record<AgendaTwizzlerTarget, TwizzlerControlSettings>;

export const isAgendaTwizzlerTarget = (
  value: string | null
): value is AgendaTwizzlerTarget =>
  AGENDA_TWIZZLER_TARGETS.some(({ id }) => id === value);

export const agendaTwizzlerDefinition = (target: AgendaTwizzlerTarget) =>
  AGENDA_TWIZZLER_TARGETS.find(({ id }) => id === target) ??
  AGENDA_TWIZZLER_TARGETS[0];

export const loadAgendaTwizzlerControlSettings = (
  target: AgendaTwizzlerTarget
): TwizzlerControlSettings => {
  const defaults = cloneTwizzlerControlSettings(
    AGENDA_TWIZZLER_CONTROL_DEFAULTS[target]
  );
  try {
    const raw = localStorage.getItem(
      `panels:${agendaTwizzlerDefinition(target).panelId}`
    );
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TwizzlerControlSettings>;
    if (!parsed || typeof parsed !== "object") return defaults;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
};

export const loadAgendaTwizzlerSettings = (
  target: AgendaTwizzlerTarget
): TwizzlerSettings =>
  resolveConnectTwizzlerSettings(loadAgendaTwizzlerControlSettings(target));

export const publishAgendaTwizzlerSettings = (
  target: AgendaTwizzlerTarget,
  values: TwizzlerControlSettings
) => {
  window.dispatchEvent(
    new CustomEvent<AgendaTwizzlerSettingsEvent>(
      AGENDA_TWIZZLER_SETTINGS_EVENT,
      {
        detail: {
          target,
          settings: resolveConnectTwizzlerSettings(values),
        },
      }
    )
  );
};
