import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/**
 * Makes a <textarea> grow with its content: no scrollbar, no resize handle.
 * The minimum height still comes from CSS (min-height).
 */
@Directive({
  selector: 'textarea[appAutoGrow]',
  host: {
    rows: '1',
    '(input)': 'resize()',
  },
})
export class AutoGrow implements AfterViewInit {
  private readonly textarea = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;

  ngAfterViewInit(): void {
    this.resize();
  }

  resize(): void {
    const el = this.textarea;
    const { borderTopWidth, borderBottomWidth } = getComputedStyle(el);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + parseFloat(borderTopWidth) + parseFloat(borderBottomWidth)}px`;
  }
}
