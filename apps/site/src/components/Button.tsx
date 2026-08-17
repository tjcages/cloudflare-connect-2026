import cn from "classnames";

type ButtonProps = {
  disabled?: boolean;
  size?: "default" | "large";
  variant?: "primary" | "secondary" | "ghost" | "link-button";
};

export default function Button({
  size = "large",
  variant = "primary",
  disabled,
  ...attributes
}: ButtonProps &
  (
    | React.ComponentProps<"button">
    | ({ href: string } & React.ComponentProps<"a">)
  )) {
  const className = cn(
    "group relative flex-center cursor-pointer rounded-full",
    "transition-all active:scale-[0.99] active:duration-30",
    "text-label-x-small",
    "[&>astro-slot>span]:relative [&>astro-slot>span]:z-1 [&>astro-slot>span]:px-6",
    "[&>span]:relative [&>span]:z-1 [&>span]:px-6",

    variant === "link-button"
      ? {
          "gap-2": size === "large",
        }
      : {
          "p-6": size === "default",
          "gap-2 p-10": size === "large",
        },

    (() => {
      if (disabled)
        return variant === "secondary"
          ? "pointer-events-none bg-background-base text-icon-faint shadow-button-secondary-rest"
          : "pointer-events-none text-icon-faint";

      if (variant === "primary") {
        return "bg-orange-900 text-text-inverse shadow-button-primary-rest hover:shadow-button-primary-hover focus-visible:shadow-button-primary-focus active:shadow-button-primary-pressed";
      }

      if (variant === "secondary") {
        return "bg-background-base shadow-button-secondary-rest hover:shadow-button-secondary-hover focus-visible:shadow-button-secondary-focus active:shadow-button-secondary-active";
      }

      if (variant === "ghost") {
        return "hover:bg-background-faint focus-visible:bg-background-ghost focus-visible:shadow-button-tertiary-focus active:bg-background-muted [&_svg]:transition not-hover:[&_svg]:text-icon-default";
      }

      if (variant === "link-button") {
        return "hover:text-orange-900 active:text-orange-1000 [&_svg]:transition not-active:not-hover:[&_svg]:text-icon-default";
      }
    })(),

    attributes.className
  );

  const Children = (
    <>
      {variant === "primary" && !disabled ? (
        <>
          <div className="overlay bg-linear-to-b from-orange-600 to-orange-900/0 to-40% opacity-24 transition-all duration-200 hover:opacity-32 active:opacity-8 active:duration-30 in-[button:focus-visible]:opacity-24" />
          <div className="overlay bg-linear-to-t from-orange-600 to-orange-900/0 to-40% opacity-24 transition-all duration-200 hover:opacity-32 active:opacity-8 active:duration-30 in-[button:focus-visible]:opacity-24" />
        </>
      ) : null}

      {attributes.children}
    </>
  );

  if ("href" in attributes) {
    return (
      <a {...attributes} className={className}>
        {Children}
      </a>
    );
  }

  return (
    <button {...attributes} className={className} disabled={disabled}>
      {Children}
    </button>
  );
}
