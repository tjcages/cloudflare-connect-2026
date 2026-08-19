import Button from "@/components/Button";
import {
  CopyFeedbackIcon,
  useCopyFeedback,
} from "@/components/copy-feedback/CopyFeedback";
import cn from "classnames";
import {
  BADGE_COMPANY_MAX,
  BADGE_NAME_MAX,
  BADGE_ROLES,
  badgeSharePath,
  clampBadgeText,
  type BadgeParams,
} from "./badge-params";
import { BADGE_THEMES } from "./badge-themes";

export default function BadgeCustomizer({
  params,
  serial,
  onChange,
}: {
  params: BadgeParams;
  serial: string;
  onChange: (next: BadgeParams) => void;
}) {
  const sharePath = badgeSharePath(params);
  const shareUrl =
    typeof window === "undefined"
      ? sharePath
      : `${window.location.origin}${sharePath}`;
  const { copied, copy } = useCopyFeedback(shareUrl);

  return (
    <div className="relative bg-background-base p-32 before:inside-border before:border-border-muted max-md:p-20">
      <div className="text-label-x-small text-text-muted">Your badge</div>
      <h2 className="mt-8 text-heading-h4 text-text-base">Make it yours</h2>
      <p className="mt-12 text-body-small text-text-default">
        Name, company, and color ride in the URL so every badge is unique and
        shareable.
      </p>

      <label className="mt-28 flex flex-col gap-8">
        <span className="text-label-x-small text-text-muted">Name</span>
        <input
          autoComplete="name"
          className="rounded-full bg-background-base px-20 py-14 text-body-x-small text-text-base shadow-input-rest transition-shadow outline-none placeholder:text-text-muted not-focus:hover:shadow-input-hover focus:shadow-input-active"
          maxLength={BADGE_NAME_MAX}
          onChange={(event) =>
            onChange({
              ...params,
              name: clampBadgeText(event.target.value, BADGE_NAME_MAX),
            })
          }
          placeholder="Jane Doe"
          type="text"
          value={params.name}
        />
      </label>

      <label className="mt-16 flex flex-col gap-8">
        <span className="text-label-x-small text-text-muted">Company</span>
        <input
          autoComplete="organization"
          className="rounded-full bg-background-base px-20 py-14 text-body-x-small text-text-base shadow-input-rest transition-shadow outline-none placeholder:text-text-muted not-focus:hover:shadow-input-hover focus:shadow-input-active"
          maxLength={BADGE_COMPANY_MAX}
          onChange={(event) =>
            onChange({
              ...params,
              company: clampBadgeText(event.target.value, BADGE_COMPANY_MAX),
            })
          }
          placeholder="Cloudflare"
          type="text"
          value={params.company}
        />
      </label>

      <div className="mt-24">
        <div className="text-label-x-small text-text-muted">Role</div>
        <div className="mt-10 flex flex-wrap gap-8">
          {BADGE_ROLES.map((role) => (
            <Button
              key={role.id}
              onClick={() => onChange({ ...params, role: role.id })}
              size="default"
              type="button"
              variant={params.role === role.id ? "primary" : "ghost"}
            >
              <span>{role.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-24">
        <div className="text-label-x-small text-text-muted">Color scheme</div>
        <div className="mt-10 grid grid-cols-4 gap-8">
          {BADGE_THEMES.map((theme) => {
            const selected = params.theme === theme.id;
            return (
              <button
                aria-label={theme.label}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center gap-8 rounded-12 p-10 text-decorative-tiny text-text-muted transition",
                  selected
                    ? "bg-background-surface shadow-[inset_0_0_0_2px_var(--color-orange-900)]"
                    : "hover:bg-background-faint"
                )}
                key={theme.id}
                onClick={() => onChange({ ...params, theme: theme.id })}
                type="button"
              >
                <span
                  className="size-28 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${theme.accent}, ${theme.pair})`,
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)",
                  }}
                />
                <span>{theme.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-28 flex flex-col gap-12">
        <div className="truncate font-mono text-body-x-small text-text-muted">
          #{serial}
          <span className="mx-8 text-border-default">·</span>
          {sharePath}
        </div>
        <Button
          className="self-start"
          onClick={copy}
          size="large"
          type="button"
        >
          <CopyFeedbackIcon copied={copied} />
          <span>{copied ? "Copied" : "Copy badge link"}</span>
        </Button>
      </div>
    </div>
  );
}
