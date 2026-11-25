import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';

/** An element lying on the grid, and the area that scrolls it (its effects never go out of it) */
interface Box {
  el: HTMLElement;
  area: HTMLElement | null;
}

/** Its place in the window this frame, and the radius of its corners */
interface Placed extends Box {
  rect: DOMRect;
  clip: DOMRect | null;
  radius: number;
}

interface Point {
  x: number;
  y: number;
}

/** How long the drawing follows the page after a change (panel sliding in, line changing size…) */
const FOLLOW_MS = 400;

/**
 * The grid of the background, behind the whole app: plain lines and the fluid effects of the
 * elements lying on it (the areas of the pages are transparent).
 * - The horizontal lines are --grid-size apart (--grid-columns squares across the window: 12 on
 *   desktop, fewer on smaller screens), fixed to the window.
 * - The vertical lines follow the elements: in each area that scrolls (work area, list of a side
 *   panel...) a line runs along the outer left edge and the outer right edge of its elements, and
 *   the width between them is divided in columns as close as possible to --grid-size (the same
 *   width again on the outside). Outside the areas: every --grid-size, like the horizontal ones.
 * - Where a line meets an element it melts into it: a hollow curve on each side of the line; where
 *   a line runs along an edge, it flows into the rounded corners at both ends (hollow curves
 *   between the line and the corner).
 * - elements side by side (no further apart than --space-200: grouped) are joined by ink between
 *   them: narrow in the middle, its ends hollow too, their tips where the corners start rounding
 *   (an X between two round ends); where one element is taller, the ink ends in a hollow curve
 *   across the gap, like a drop between two walls.
 * The elements stacked in a column are joined by their own styles (ink-joins of _fluid.scss), so
 * they move together with them when the page scrolls.
 *
 * An element lies on the grid when it has a background or an outline and nothing around it does
 * (the elements inside it lie on it, not on the grid). Dialogs, menus and other floating elements
 * are left out.
 */
@Component({
  selector: 'app-grid-backdrop',
  template: '<canvas #canvas></canvas>',
  styleUrl: './grid-backdrop.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridBackdrop {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  private boxes: Box[] = [];
  private areas: HTMLElement[] = [];
  /** The page changed: find the elements again before the next drawing */
  private stale = true;
  private frame = 0;
  private followUntil = 0;

  constructor() {
    afterNextRender(() => {
      const follow = () => this.follow();
      const changed = () => {
        this.stale = true;
        this.follow();
      };
      const observer = new MutationObserver(changed);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'open'],
      });
      const options = { capture: true, passive: true };
      addEventListener('scroll', follow, options);
      addEventListener('resize', changed);
      addEventListener('transitionrun', follow, options);
      addEventListener('animationstart', follow, options);
      document.fonts.ready.then(changed);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        removeEventListener('scroll', follow, options);
        removeEventListener('resize', changed);
        removeEventListener('transitionrun', follow, options);
        removeEventListener('animationstart', follow, options);
        cancelAnimationFrame(this.frame);
      });
      changed();
    });
  }

  /** Draws at every frame for a moment, so the effects follow what moves */
  private follow(): void {
    this.followUntil = performance.now() + FOLLOW_MS;
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    this.frame = 0;
    if (this.stale) {
      ({ boxes: this.boxes, areas: this.areas } = findBoxes(document.querySelector('.app-main')));
      this.stale = false;
    }
    this.draw();
    if (now < this.followUntil) this.frame = requestAnimationFrame(this.tick);
  };

  private draw(): void {
    const canvas = this.canvas().nativeElement;
    const width = innerWidth;
    const height = innerHeight;
    const ratio = devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const root = getComputedStyle(document.documentElement);
    const columns = Number.parseFloat(root.getPropertyValue('--grid-columns')) || 12;
    const size = Math.floor(width / columns);
    const line = px(root, '--stroke-border') || 1;
    const join = px(root, '--grid-join');
    const groupGap = px(root, '--space-200');
    // Lines, curves and joins: the colour of the outlines, so they merge with the elements
    const outline = root.getPropertyValue('--color-outline').trim();
    if (size < 4) return;

    ctx.fillStyle = outline;

    // Horizontal lines
    for (let y = 0; y <= height; y += size) ctx.fillRect(0, y, width, line);

    const measured = this.boxes
      .map((box) => ({ ...box, rect: box.el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width >= 1 && rect.height >= 1);

    // Vertical lines: along the elements of each area, every --grid-size elsewhere
    const everywhere = steps(0, size, 0, width);
    const linesOf = new Map<HTMLElement | null, number[]>([[null, everywhere]]);
    const areas = this.areas
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width >= 1 && rect.height >= 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    for (const { rect } of areas) ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.clip('evenodd');
    for (const x of everywhere) ctx.fillRect(x, 0, line, height);
    ctx.restore();
    for (const area of areas) {
      const own = measured.filter((box) => box.area === area.el).map((box) => box.rect);
      const lines = alongElements(own, area.rect, size, line) ?? everywhere;
      linesOf.set(area.el, lines);
      ctx.save();
      clipTo(ctx, area.rect);
      for (const x of lines) ctx.fillRect(x, area.rect.top, line, area.rect.height);
      ctx.restore();
    }

    const placed = measured
      .map((box): Placed | null => {
        const clip = box.area?.getBoundingClientRect() ?? null;
        if (clip && (box.rect.bottom < clip.top || box.rect.top > clip.bottom)) return null;
        return { ...box, clip, radius: cornerRadius(box.el, box.rect) };
      })
      .filter((box): box is Placed => !!box);

    // The lines melt into the elements they meet
    for (const box of placed) {
      ctx.save();
      clipTo(ctx, box.clip);
      ctx.beginPath();
      meltLines(ctx, box, linesOf.get(box.area) ?? everywhere, size, line, join);
      ctx.fill();
      ctx.restore();
    }

    // Ink between the elements side by side (the colour of the outlines)
    const sorted = [...placed].sort((a, b) => a.rect.left - b.rect.left);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (a.area !== b.area) continue;
        const gap = b.rect.left - a.rect.right;
        if (gap > groupGap + 0.5) break;
        if (gap < -0.5) continue;
        inkBetween(ctx, a, b, gap);
      }
    }
  }
}

/**
 * The outermost elements with a background or an outline, inside the page, and the areas that
 * scroll them
 */
function findBoxes(root: Element | null): { boxes: Box[]; areas: HTMLElement[] } {
  const boxes: Box[] = [];
  const areas: HTMLElement[] = [];
  const walk = (parent: Element, area: HTMLElement | null) => {
    for (const el of Array.from(parent.children)) {
      if (!(el instanceof HTMLElement) || el.tagName === 'DIALOG') continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.position === 'fixed' || style.position === 'absolute') continue;
      // display: contents draws no box of its own: its children are laid out in its place
      if (style.display !== 'contents' && isDrawn(style)) boxes.push({ el, area });
      else if (/(auto|scroll)/.test(style.overflowY)) {
        areas.push(el);
        walk(el, el);
      } else walk(el, area);
    }
  };
  if (root) walk(root, null);
  return { boxes, areas };
}

/** x of the lines from `start`, every `step`, between `from` and `to` (whole pixels) */
function steps(start: number, step: number, from: number, to: number): number[] {
  const lines: number[] = [];
  for (let k = Math.ceil((from - start) / step); start + k * step <= to; k++) {
    lines.push(Math.round(start + k * step));
  }
  return lines;
}

/**
 * Vertical lines of an area: one on the outer left edge of its elements, one on their outer right
 * edge (on the outline: its last pixel), and columns between them as close as possible to `size`,
 * the same width going on outside them. None when the area has no element.
 */
function alongElements(rects: DOMRect[], area: DOMRect, size: number, line: number): number[] | null {
  if (!rects.length) return null;
  const left = Math.round(Math.min(...rects.map((rect) => rect.left)));
  const right = Math.round(Math.max(...rects.map((rect) => rect.right))) - line;
  if (right - left < size / 2) return null;
  const columns = Math.max(1, Math.round((right - left) / size));
  return steps(left, (right - left) / columns, area.left, area.right);
}

/** Has a background or an outline of its own */
function isDrawn(style: CSSStyleDeclaration): boolean {
  const outlined = Number.parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none' && !isTransparent(style.borderTopColor);
  return outlined || !isTransparent(style.backgroundColor);
}

function isTransparent(color: string): boolean {
  return color === 'transparent' || /,\s*0\)$/.test(color) || /\/\s*0\)$/.test(color);
}

function px(style: CSSStyleDeclaration, name: string): number {
  return Number.parseFloat(style.getPropertyValue(name)) || 0;
}

/** Radius of the corners (the first one), at most half of the smaller side */
function cornerRadius(el: HTMLElement, rect: DOMRect): number {
  const value = getComputedStyle(el).borderTopLeftRadius;
  const radius = value.endsWith('%') ? (Number.parseFloat(value) / 100) * rect.width : Number.parseFloat(value) || 0;
  return Math.min(radius, rect.width / 2, rect.height / 2);
}

function clipTo(ctx: CanvasRenderingContext2D, clip: DOMRect | null): void {
  if (!clip) return;
  ctx.beginPath();
  ctx.rect(clip.left, clip.top, clip.width, clip.height);
  ctx.clip();
}

/**
 * Where a line of the grid meets a straight edge of the element: a hollow curve on each side of
 * the line, between the line and the edge (none where the edge is already rounding off). Where a
 * vertical line runs along its left or right edge: it flows into the rounded corners at both ends.
 */
function meltLines(
  ctx: CanvasRenderingContext2D,
  box: Placed,
  verticals: number[],
  size: number,
  line: number,
  join: number,
): void {
  const { left, right, top, bottom } = box.rect;
  const r = box.radius;
  const middle = line / 2;
  for (const x of verticals) {
    // Along the left or right edge
    const onLeft = Math.abs(x - left) < 1;
    if (onLeft || Math.abs(x + line - right) < 1) {
      const side = onLeft ? left : right;
      const inward = onLeft ? 1 : -1;
      flowIntoCorner(ctx, { x: side, y: top + r }, inward, -1, r, join);
      flowIntoCorner(ctx, { x: side, y: bottom - r }, inward, 1, r, join);
      continue;
    }
    // Meeting the top and bottom edges
    const at = x + middle;
    if (join <= 0 || at < left + r || at > right - r) continue;
    for (const [y, out] of [
      [top, -1],
      [bottom, 1],
    ] as const) {
      melt(ctx, { x: at, y }, { x: -1, y: 0 }, { x: 0, y: out }, Math.min(join, at - (left + r)));
      melt(ctx, { x: at, y }, { x: 1, y: 0 }, { x: 0, y: out }, Math.min(join, right - r - at));
    }
  }
  // Horizontal lines meeting the left and right edges
  if (join <= 0) return;
  for (let y = Math.ceil((top + r) / size) * size; y + middle <= bottom - r; y += size) {
    const at = y + middle;
    for (const [x, out] of [
      [left, -1],
      [right, 1],
    ] as const) {
      melt(ctx, { x, y: at }, { x: 0, y: -1 }, { x: out, y: 0 }, Math.min(join, at - (top + r)));
      melt(ctx, { x, y: at }, { x: 0, y: 1 }, { x: out, y: 0 }, Math.min(join, bottom - r - at));
    }
  }
}

/**
 * A line running along an edge, where the rounded corner leaves it (`at`): the line flows into the
 * corner with a hollow curve, a circle of `join` (at most the corner's radius) touching both the
 * line and the corner. `inward`: side of the element (1: on the right of the line); `towards`: way
 * the corner goes from `at` (-1: up, a top corner).
 */
function flowIntoCorner(
  ctx: CanvasRenderingContext2D,
  at: Point,
  inward: number,
  towards: number,
  radius: number,
  join: number,
): void {
  const curve = Math.min(join, radius);
  if (radius < 1 || curve < 1) return;
  // Drawn for a top corner on the right of the line, then turned: the line on x = 0, the corner
  // circle centred (radius, 0), the curve centred (curve, -reach), touching both
  const reach = 2 * Math.sqrt(radius * curve);
  let meet = Math.atan2(-reach, curve - radius);
  if (meet < 0) meet += Math.PI * 2;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(inward, -towards);
  ctx.moveTo(0, -reach);
  ctx.lineTo(0, 0);
  ctx.arc(radius, 0, radius, Math.PI, meet);
  ctx.arc(curve, -reach, curve, meet - Math.PI, Math.PI);
  ctx.closePath();
  ctx.restore();
}

/** Hollow curve in the corner between the edge (along `edge` from `at`) and the line (along `out`) */
function melt(ctx: CanvasRenderingContext2D, at: Point, edge: Point, out: Point, radius: number): void {
  if (radius < 1) return;
  ctx.moveTo(at.x + edge.x * radius, at.y + edge.y * radius);
  ctx.arcTo(at.x, at.y, at.x + out.x * radius, at.y + out.y * radius, radius);
  ctx.lineTo(at.x, at.y);
  ctx.closePath();
}

/**
 * Ink between two elements side by side (b on the right of a), along the height they share: across
 * the gap and in the hollows of their facing corners, its tips where the corners start rounding
 * (where the straight top and bottom edges end). An end where both elements end together is hollow
 * too (a circle through the two tips, sagging half way to the middle): an X between two round
 * ends. Where one of them goes on, the ink ends in a hollow curve across the gap (a half circle),
 * like a drop held between two walls.
 */
function inkBetween(ctx: CanvasRenderingContext2D, a: Placed, b: Placed, gap: number): void {
  const top = Math.max(a.rect.top, b.rect.top);
  const bottom = Math.min(a.rect.bottom, b.rect.bottom);
  if (bottom - top < 1) return;
  const sameTop = Math.abs(a.rect.top - b.rect.top) < 1;
  const sameBottom = Math.abs(a.rect.bottom - b.rect.bottom) < 1;
  const inset = Math.max(a.radius, b.radius);
  const bandTop = sameTop ? top : top + inset;
  const bandBottom = sameBottom ? bottom : bottom - inset;
  if (bandBottom - bandTop < 1) return;
  const left = a.rect.right - a.radius;
  const right = b.rect.left + b.radius;
  const middle = (left + right) / 2;
  const gapMiddle = (a.rect.right + b.rect.left) / 2;
  const half = gap / 2;
  // Hollow end through the two tips: half chord c, sag c / 2 → radius 1.25 c, centre 0.75 c away
  const chord = (right - left) / 2;

  ctx.save();
  clipTo(ctx, a.clip);
  clipTo(ctx, new DOMRect(left, bandTop, right - left, bandBottom - bandTop));
  clipOut(ctx, (path) => path.roundRect(a.rect.left, a.rect.top, a.rect.width, a.rect.height, a.radius));
  clipOut(ctx, (path) => path.roundRect(b.rect.left, b.rect.top, b.rect.width, b.rect.height, b.radius));
  for (const [end, same, way] of [
    [bandTop, sameTop, -1],
    [bandBottom, sameBottom, 1],
  ] as const) {
    if (same) clipOut(ctx, (path) => path.arc(middle, end + way * 0.75 * chord, 1.25 * chord, 0, Math.PI * 2));
    else if (half > 0) clipOut(ctx, (path) => path.arc(gapMiddle, end, half, 0, Math.PI * 2));
  }
  ctx.fillRect(left, bandTop, right - left, bandBottom - bandTop);
  ctx.restore();
}

/** Restricts the drawing to outside a shape (the whole window less the shape) */
function clipOut(ctx: CanvasRenderingContext2D, shape: (path: Path2D) => void): void {
  const path = new Path2D();
  path.rect(-1e5, -1e5, 2e5, 2e5);
  shape(path);
  ctx.clip(path, 'evenodd');
}
