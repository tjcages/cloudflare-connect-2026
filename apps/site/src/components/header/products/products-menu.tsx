import Button from "@/components/Button";
import Icon from "@/components/icon/Icon";
import NavigationItem from "@/components/NavigationItem";
import { headerProductGroups } from "@/constants/products";
import type { IHeaderMenu } from "../menu/HeaderMenu";
import HeaderMenuContent from "../menu/HeaderMenuContent";

export const productsMenu: IHeaderMenu = {
  groups: headerProductGroups,
  seeAllLabel: "See all products",
  seeAllHref: "/products",
  banner: true,
  footer: true,
  renderContent: (activeIndex, direction) => {
    const activeGroup = headerProductGroups[activeIndex];

    return (
      <HeaderMenuContent
        direction={direction}
        action={
          <Button
            className="shrink-0"
            href={`/products?category=${activeGroup.slug}`}
            variant="link-button"
          >
            <span className="whitespace-nowrap">See all</span>
            <Icon
              className="transition-transform group-hover:translate-x-2"
              name="chevron-right-small"
            />
          </Button>
        }
        columns={3}
        itemKey={(item) => item.label}
        items={activeGroup.items}
        renderItem={(item) => (
          <NavigationItem
            description={item.description}
            href={item.href}
            icon={item.iconName}
            isNew={item.isNew}
            label={item.label}
          />
        )}
        title={activeGroup.label}
      />
    );
  },
};
