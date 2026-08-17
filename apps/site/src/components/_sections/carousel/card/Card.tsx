import Button from "@/components/Button";
import Icon from "@/components/icon/Icon";
import Screenshot from "./Screenshot";
import Generation from "./Generation";
import Automation from "./Automation";

type Props = {
  title: string;
  description: string;
  href: string;
  type: "screenshot" | "automation" | "generation";
};

export default function CarouselCard({
  title,
  description,
  href,
  type,
}: Props) {
  const components = {
    screenshot: Screenshot,
    automation: Automation,
    generation: Generation,
  };

  const Component = components[type];
  return (
    <div className="relative mr-40 w-480 shrink-0 snap-center bg-background-base p-40 shadow-elevation-default">
      <div className="relative mb-32 bg-background-surface before:inside-border before:z-20 before:border-border-muted">
        {<Component />}
      </div>
      <div className="text-label-large text-text-base">{title}</div>
      <div className="mt-4 mb-32 w-full max-w-400 text-body-medium text-text-default">
        {description}
      </div>

      <Button
        href={href}
        className="w-max text-text-muted"
        variant="link-button"
      >
        See more <Icon name="chevron-right-small" />
      </Button>
    </div>
  );
}
