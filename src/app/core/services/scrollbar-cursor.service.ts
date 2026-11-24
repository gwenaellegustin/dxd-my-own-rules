import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const HOVER_CLASS = 'scrollbar-hover';
const PRESSED_CLASS = 'scrollbar-pressed';

/**
 * Hand cursor over the scrollbars (thumb, track, arrows) and closed hand while one is held, so the
 * user sees they can be grabbed.
 *
 * CSS alone cannot do it: Chrome / Edge ignore `cursor` on the ::-webkit-scrollbar pseudo-elements
 * and show, over a styled scrollbar, the cursor of the element that scrolls. So the pointer
 * position is compared with that element's scrollbar area, and while it is over it the element
 * gets a class that sets its cursor (see styles.scss). Firefox keeps its arrow.
 */
@Injectable({ providedIn: 'root' })
export class ScrollbarCursorService {
  private readonly document = inject(DOCUMENT);

  private hovered: Element | null = null;
  private pressed = false;

  init(): void {
    const options = { capture: true, passive: true };
    const on = <K extends keyof DocumentEventMap>(
      type: K,
      listener: (event: DocumentEventMap[K]) => void,
    ) => this.document.addEventListener(type, listener, options);

    on('pointermove', (event) => this.onMove(event));
    on('pointerdown', (event) => this.onDown(event));
    on('pointerup', () => this.release());
    on('pointercancel', () => this.release());
    // Pointer out of the window
    on('pointerout', (event) => {
      if (!event.relatedTarget) this.setHovered(null);
    });
    this.document.defaultView?.addEventListener('blur', () => {
      this.release();
      this.setHovered(null);
    });
  }

  private onMove(event: PointerEvent): void {
    if (this.pressed) {
      if (event.buttons & 1) return; // still dragging
      // Chrome may send no pointerup at the end of a scrollbar drag: the button being up is enough
      this.release();
    }
    this.setHovered(overScrollbar(event));
  }

  private onDown(event: PointerEvent): void {
    if (event.button !== 0 || !overScrollbar(event)) return;
    this.pressed = true;
    this.document.documentElement.classList.add(PRESSED_CLASS);
  }

  private release(): void {
    if (!this.pressed) return;
    this.pressed = false;
    this.document.documentElement.classList.remove(PRESSED_CLASS);
  }

  private setHovered(element: Element | null): void {
    if (element === this.hovered) return;
    this.hovered?.classList.remove(HOVER_CLASS);
    element?.classList.add(HOVER_CLASS);
    this.hovered = element;
  }
}

/** The element whose scrollbar is under the pointer (events over a scrollbar target its element) */
function overScrollbar(event: PointerEvent): HTMLElement | null {
  const element = event.target;
  if (event.pointerType === 'touch' || !(element instanceof HTMLElement)) return null;

  // Distance past the padding box: the scrollbars are drawn between it and the border
  const rect = element.getBoundingClientRect();
  const right = event.clientX - rect.left - element.clientLeft - element.clientWidth;
  const below = event.clientY - rect.top - element.clientTop - element.clientHeight;
  if (right < 0 && below < 0) return null; // inside the content: no style lookup

  const style = getComputedStyle(element);
  const verticalBar =
    element.offsetWidth -
    element.clientLeft -
    element.clientWidth -
    parseFloat(style.borderRightWidth);
  const horizontalBar =
    element.offsetHeight -
    element.clientTop -
    element.clientHeight -
    parseFloat(style.borderBottomWidth);

  const onVertical = scrolls(style.overflowY) && right >= 0 && right < verticalBar && below < 0;
  const onHorizontal = scrolls(style.overflowX) && below >= 0 && below < horizontalBar && right < 0;
  return onVertical || onHorizontal ? element : null;
}

function scrolls(overflow: string): boolean {
  return overflow === 'auto' || overflow === 'scroll';
}
