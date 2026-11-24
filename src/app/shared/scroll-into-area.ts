/**
 * Scrolls the nearest scrollable area (work area, panel…) so that `element` is shown, without
 * scrolling the window like `scrollIntoView` does (that would move the header out of view).
 * `start`: element at the top of the area (minus `margin`); `center`: in the middle.
 */
export function scrollIntoArea(
  element: HTMLElement,
  { block = 'start', margin = 16, smooth = false }: { block?: 'start' | 'center'; margin?: number; smooth?: boolean } = {},
): void {
  const area = scrollableParent(element);
  if (!area) return;
  const offset = element.getBoundingClientRect().top - area.getBoundingClientRect().top;
  const target =
    block === 'center'
      ? area.scrollTop + offset - (area.clientHeight - element.offsetHeight) / 2
      : area.scrollTop + offset - margin;
  area.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
}

function scrollableParent(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}
