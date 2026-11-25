/**
 * Desktop layout: the side panels sit next to the work area (below it, they overlay it).
 * The width is defined once, in _breakpoints.scss ($width-lg), and given to TypeScript as
 * --breakpoint-desktop on <html> (see styles.scss).
 */
export const isDesktop = (): boolean => {
  const width = getComputedStyle(document.documentElement).getPropertyValue('--breakpoint-desktop').trim();
  return matchMedia(`(min-width: ${width})`).matches;
};
