import { Directive, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

/**
 * Opens a native <dialog> as a modal as soon as it is rendered (focus trap, backdrop and
 * Escape come with the browser) and reports when the user wants to leave it:
 * Escape or a click on the backdrop emits `dismiss` (`closeOnBackdrop` false: Escape only, for
 * dialogs with unsaved input). The parent removes the dialog (@if).
 *
 * Usage: @if (open) { <dialog class="dialog" appModalDialog (dismiss)="open = false">…</dialog> }
 */
@Directive({
  selector: 'dialog[appModalDialog]',
  host: {
    '(cancel)': 'onCancel($event)',
    '(click)': 'onClick($event)',
  },
})
export class ModalDialog {
  readonly dismiss = output<void>();
  readonly closeOnBackdrop = input(true);

  private readonly dialog = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;

  constructor() {
    afterNextRender(() => this.dialog.showModal());
  }

  /** Escape: the parent decides (it removes the dialog), the browser does not close it alone */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.dismiss.emit();
  }

  /** A click on the dialog element itself (not its content) is a click on the backdrop */
  protected onClick(event: MouseEvent): void {
    if (this.closeOnBackdrop() && event.target === this.dialog) this.dismiss.emit();
  }
}
