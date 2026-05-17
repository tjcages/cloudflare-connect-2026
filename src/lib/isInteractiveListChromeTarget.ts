export const isInteractiveListChromeTarget = (target: Element | null): boolean => {
  if (target === null) {
    return false;
  }
  return Boolean(target.closest("button") || target.closest('[data-slot="list-item-actions"]'));
};
