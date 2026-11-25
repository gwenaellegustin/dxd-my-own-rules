import { Directive, ElementRef, inject, input } from '@angular/core';
import { PanelName, PanelWidthService } from '../../core/services/panel-width.service';

/** Width added or removed by one arrow key */
const KEY_STEP = 16;

/**
 * Handle on the inner edge of a side panel (desktop only, styled by the side-panel mixin): drag
 * it, or use the arrow keys, to change the width of the panel; double click: default width.
 * The handle is a direct child of the panel. Usage:
 *   <div [appPanelResize]="'transcript'" side="right" [attr.aria-label]="…"></div>
 */
@Directive({
  selector: '[appPanelResize]',
  host: {
    class: 'resize',
    role: 'separator',
    tabindex: '0',
    'aria-orientation': 'vertical',
    '(pointerdown)': 'start($event)',
    '(dblclick)': 'widths.set(name(), null)',
    '(keydown.arrowleft)': 'step(-KEY_STEP)',
    '(keydown.arrowright)': 'step(KEY_STEP)',
  },
})
export class PanelResize {
  readonly name = input.required<PanelName>({ alias: 'appPanelResize' });
  /** Side of the window the panel is on: moving toward the work area makes it wider */
  readonly side = input.required<'left' | 'right'>();

  protected readonly widths = inject(PanelWidthService);
  protected readonly KEY_STEP = KEY_STEP;
  private readonly handle = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected start(event: PointerEvent): void {
    const panel = this.panel();
    const startX = event.clientX;
    const startWidth = panel.getBoundingClientRect().width;
    this.handle.setPointerCapture(event.pointerId);
    event.preventDefault();
    const move = (e: PointerEvent) => this.resize(panel, startWidth + this.grow(e.clientX - startX));
    const end = () => {
      this.handle.removeEventListener('pointermove', move);
      this.handle.removeEventListener('pointerup', end);
      this.handle.removeEventListener('pointercancel', end);
    };
    this.handle.addEventListener('pointermove', move);
    this.handle.addEventListener('pointerup', end);
    this.handle.addEventListener('pointercancel', end);
  }

  /** Arrow keys move the edge like the pointer would */
  protected step(dx: number): void {
    const panel = this.panel();
    this.resize(panel, panel.getBoundingClientRect().width + this.grow(dx));
  }

  /** A move to the right widens a left panel and narrows a right one */
  private grow(dx: number): number {
    return this.side() === 'left' ? dx : -dx;
  }

  private panel(): HTMLElement {
    return this.handle.parentElement!;
  }

  /** Between the min / max width tokens */
  private resize(panel: HTMLElement, width: number): void {
    const style = getComputedStyle(panel);
    const min = parseFloat(style.getPropertyValue('--panel-min-width')) || 0;
    const max = parseFloat(style.getPropertyValue('--panel-max-width')) || width;
    this.widths.set(this.name(), Math.min(max, Math.max(min, width)));
  }
}
