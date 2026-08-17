import Button from "@/components/Button";
import CornerDots from "@/components/CornerDots";
import Icon from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons.gen";

export default function HeaderMenuFooter() {
  return (
    <div className="relative flex justify-end gap-8 px-40 py-20 before:inside-border-t before:border-border-default">
      <CornerDots accentClassName="bg-green-900" count={4} />

      {footerItems.map((item) => (
        <Button key={item.label} variant="ghost">
          <Icon name={item.iconName} />
          <span>{item.label}</span>
        </Button>
      ))}
    </div>
  );
}

const footerItems: { iconName: IconName; label: string }[] = [
  {
    iconName: "cloudflare-os",
    label: "CloudflareOS",
  },
  {
    iconName: "globe-2",
    label: "Global Network",
  },
  {
    iconName: "input-form",
    label: "Domain Registration",
  },
  {
    iconName: "1-1-1-1",
    label: "1.1.1.1",
  },
];
