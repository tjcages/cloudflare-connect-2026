import {
  DEFAULT_BADGE_THEME_ID,
  findBadgeTheme,
  isBadgeThemeId,
  type BadgeThemeId,
} from "./badge-themes";

export const BADGE_ROLE_IDS = [
  "attendee",
  "speaker",
  "staff",
  "partner",
] as const;

export type BadgeRoleId = (typeof BADGE_ROLE_IDS)[number];

export type BadgeRole = {
  id: BadgeRoleId;
  label: string;
};

export const BADGE_ROLES: readonly BadgeRole[] = [
  { id: "attendee", label: "Attendee" },
  { id: "speaker", label: "Speaker" },
  { id: "staff", label: "Staff" },
  { id: "partner", label: "Partner" },
];

export const DEFAULT_BADGE_ROLE_ID: BadgeRoleId = "attendee";

export const BADGE_NAME_MAX = 40;
export const BADGE_COMPANY_MAX = 40;

export type BadgeParams = {
  name: string;
  company: string;
  theme: BadgeThemeId;
  role: BadgeRoleId;
};

export const DEFAULT_BADGE_PARAMS: BadgeParams = {
  name: "",
  company: "",
  theme: DEFAULT_BADGE_THEME_ID,
  role: DEFAULT_BADGE_ROLE_ID,
};

const PLACEHOLDER_NAME = "Your name";
const PLACEHOLDER_COMPANY = "Your company";

export function isBadgeRoleId(
  value: string | null | undefined
): value is BadgeRoleId {
  return BADGE_ROLE_IDS.some((id) => id === value);
}

export function clampBadgeText(value: string, max: number): string {
  return value.replaceAll(/\s+/g, " ").trimStart().slice(0, max);
}

export function displayBadgeName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : PLACEHOLDER_NAME;
}

export function displayBadgeCompany(company: string): string {
  const trimmed = company.trim();
  return trimmed.length > 0 ? trimmed : PLACEHOLDER_COMPANY;
}

export function findBadgeRole(id: string | null | undefined): BadgeRole {
  const match = BADGE_ROLES.find((role) => role.id === id);
  return match ?? BADGE_ROLES[0];
}

/** FNV-1a so the same name + company always mint the same badge serial. */
export function hashBadgeIdentity(name: string, company: string): number {
  const input = `${name.trim().toLowerCase()}|${company.trim().toLowerCase()}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function formatBadgeSerial(hash: number): string {
  return hash.toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}

export function parseBadgeSearch(search: string): BadgeParams {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const themeValue = params.get("theme");
  const roleValue = params.get("role");
  return {
    name: clampBadgeText(params.get("name") ?? "", BADGE_NAME_MAX).trim(),
    company: clampBadgeText(
      params.get("company") ?? "",
      BADGE_COMPANY_MAX
    ).trim(),
    theme: isBadgeThemeId(themeValue) ? themeValue : DEFAULT_BADGE_THEME_ID,
    role: isBadgeRoleId(roleValue) ? roleValue : DEFAULT_BADGE_ROLE_ID,
  };
}

export function serializeBadgeSearch(params: BadgeParams): string {
  const search = new URLSearchParams();
  const name = params.name.trim();
  const company = params.company.trim();
  if (name) search.set("name", name);
  if (company) search.set("company", company);
  if (params.theme !== DEFAULT_BADGE_THEME_ID)
    search.set("theme", params.theme);
  if (params.role !== DEFAULT_BADGE_ROLE_ID) search.set("role", params.role);
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

export function badgeSharePath(params: BadgeParams): string {
  return `/connect/badge${serializeBadgeSearch(params)}`;
}

export function resolveBadgeView(params: BadgeParams) {
  const theme = findBadgeTheme(params.theme);
  const role = findBadgeRole(params.role);
  const hash = hashBadgeIdentity(params.name, params.company);
  return {
    theme,
    role,
    hash,
    serial: formatBadgeSerial(hash),
    name: displayBadgeName(params.name),
    company: displayBadgeCompany(params.company),
  };
}
