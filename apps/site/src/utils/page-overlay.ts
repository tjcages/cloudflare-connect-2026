export type PageOverlayOwner = "header" | "command-menu";

export const setPageOverlayOwner = (owner: PageOverlayOwner, open: boolean) => {
  const root = document.documentElement;
  const owners = new Set(
    (root.dataset.pageOverlayOpen ?? "").split(" ").filter(Boolean)
  );

  if (open) owners.add(owner);
  else owners.delete(owner);

  if (owners.size === 0) delete root.dataset.pageOverlayOpen;
  else root.dataset.pageOverlayOpen = [...owners].join(" ");
};
