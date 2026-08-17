import cn from "classnames";

export default function CornerDots({
  count = 2,
  accentClassName = "bg-orange-900",
  faintClassName,
}: {
  count?: 2 | 4;
  accentClassName?: string;
  faintClassName?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "absolute top-9 left-9 size-2 rounded-full",
          accentClassName
        )}
      />
      <div
        className={cn(
          "absolute top-9 right-9 size-2 rounded-full",
          accentClassName
        )}
      />

      {count === 4 && (
        <>
          <div
            className={cn(
              "absolute -top-11 -left-11 size-2 rounded-full bg-icon-faint",
              faintClassName
            )}
          />
          <div
            className={cn(
              "absolute -top-11 -right-11 size-2 rounded-full bg-icon-faint",
              faintClassName
            )}
          />
        </>
      )}
    </>
  );
}
