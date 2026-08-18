import Icon from "@/components/icon/Icon";

export default function SearchInput({
  value,
  onChange,
  inputRef,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  ariaLabel: string;
  placeholder: string;
}) {
  return (
    <div className="flex w-560 items-center gap-4 rounded-full bg-background-base p-11 shadow-input-rest transition-shadow focus-within:shadow-input-active not-focus-within:hover:shadow-input-hover max-lg:w-full">
      <Icon
        className="mx-2 text-icon-muted"
        name="magnifying-glass-2"
        size={20}
      />

      <input
        aria-label={ariaLabel}
        className="min-w-0 flex-1 px-6 py-2 text-body-x-small text-text-base outline-none placeholder:text-text-muted"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onChange("");
            event.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        ref={inputRef}
        type="text"
        value={value}
      />
    </div>
  );
}
