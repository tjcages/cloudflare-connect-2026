import NavigationItem from "@/components/NavigationItem";
import { headerResourceGroups } from "@/constants/resources";
import type { IHeaderMenu } from "../menu/HeaderMenu";
import HeaderMenuContent from "../menu/HeaderMenuContent";

export const resourcesMenu: IHeaderMenu = {
  groups: headerResourceGroups,
  seeAllLabel: "See all resources",
  seeAllHref: "/resources",
  banner: true,
  footer: true,
  renderContent: (activeIndex, direction) => {
    const activeGroup = headerResourceGroups[activeIndex];

    return (
      <HeaderMenuContent
        columns={2}
        direction={direction}
        itemKey={(item) => item.label}
        items={activeGroup.items}
        renderItem={(item) => (
          <NavigationItem
            description={item.description}
            href={item.href}
            icon={item.iconName}
            label={item.label}
          />
        )}
        title={activeGroup.label}
      />
    );
  },
};
