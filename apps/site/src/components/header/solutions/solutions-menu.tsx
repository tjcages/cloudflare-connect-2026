import NavigationItem from "@/components/NavigationItem";
import { headerSolutionGroups } from "@/constants/solutions";
import type { IHeaderMenu } from "../menu/HeaderMenu";
import HeaderMenuContent from "../menu/HeaderMenuContent";

export const solutionsMenu: IHeaderMenu = {
  groups: headerSolutionGroups,
  seeAllLabel: "See all solutions",
  seeAllHref: "/solutions",
  banner: true,
  footer: true,
  renderContent: (activeIndex, direction) => {
    const activeGroup = headerSolutionGroups[activeIndex];

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
