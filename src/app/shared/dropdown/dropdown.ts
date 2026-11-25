import { Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * A button that opens a small menu (account, mobile navigation, sort…). Put it on the element
 * that wraps the button and the menu; the menu closes on a click outside that element or on
 * Escape. Style the menu with the global `.dropdown-menu` class (dark, right-aligned by default,
 * `.dropdown-menu--start` to align it on the left; `.dropdown-menu--field`: light list of choices of a field).
 *
 * <div appDropdown #menu="appDropdown">
 *   <button (click)="menu.toggle()" [attr.aria-expanded]="menu.open()">…</button>
 *   @if (menu.open()) { <div class="dropdown-menu" role="menu">…</div> }
 * </div>
 */
@Directive({
  selector: '[appDropdown]',
  exportAs: 'appDropdown',
  host: {
    class: 'dropdown',
    '(document:click)': 'closeOutside($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class Dropdown {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly open = signal(false);

  toggle(): void {
    this.open.update((open) => !open);
  }

  close(): void {
    this.open.set(false);
  }

  protected closeOutside(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }
}
