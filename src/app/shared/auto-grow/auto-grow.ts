import { AfterViewChecked, AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/**
 * Makes a <textarea> grow with its content: no scrollbar, no resize handle, everything readable.
 * The minimum height still comes from CSS (min-height).
 *
 * The height is recomputed when:
 * - the user types;
 * - the value is changed by the app (e.g. another worksheet is selected);
 * - the width changes (panel opened / closed, window resized), since the text wraps differently;
 * - the web font has loaded (the text size may change).
 */
@Directive({
  selector: 'textarea[appAutoGrow]',
  host: {
    rows: '1',
    '(input)': 'resize()',
  },
})
export class AutoGrow implements AfterViewInit, AfterViewChecked, OnDestroy {
  private readonly textarea = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;

  private lastValue: string | null = null;
  private lastWidth = 0;
  private readonly resizeObserver = new ResizeObserver(([entry]) => {
    // Only width matters: a height change is our own resize
    const width = entry.contentRect.width;
    if (width !== this.lastWidth) {
      this.lastWidth = width;
      this.resize();
    }
  });

  ngAfterViewInit(): void {
    this.resize();
    this.resizeObserver.observe(this.textarea);
    document.fonts?.ready.then(() => this.resize());
  }

  /** [value] bindings set the property without an input event: checked once the view is updated */
  ngAfterViewChecked(): void {
    if (this.lastValue !== null && this.textarea.value !== this.lastValue) this.resize();
  }

  ngOnDestroy(): void {
    this.resizeObserver.disconnect();
  }

  resize(): void {
    const el = this.textarea;
    this.lastValue = el.value;
    // Hidden fields (collapsed section) have no layout: measured when they become visible
    if (!el.isConnected || el.offsetParent === null) return;
    const { borderTopWidth, borderBottomWidth } = getComputedStyle(el);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + parseFloat(borderTopWidth) + parseFloat(borderBottomWidth)}px`;
  }
}
