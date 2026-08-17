import NavigationItem from "@/components/NavigationItem";
import type { IHeaderMenu } from "../menu/HeaderMenu";
import HeaderMenuContent from "../menu/HeaderMenuContent";
import {
  connectResourceGroups,
  type ConnectResourceItem,
} from "./resources-data";

export const connectResourcesMenu: IHeaderMenu = {
  groups: connectResourceGroups,
  seeAllLabel: "Register for Connect",
  seeAllHref: "https://events.www.cloudflare.com/connect2026/begin",
  renderContent: (activeIndex, direction) => {
    const activeGroup = connectResourceGroups[activeIndex];

    return (
      <HeaderMenuContent
        columns={2}
        direction={direction}
        itemKey={(item: ConnectResourceItem) => item.label}
        items={activeGroup.items}
        renderItem={(item: ConnectResourceItem) => (
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
