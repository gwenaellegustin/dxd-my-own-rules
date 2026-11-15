import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AutoGrow } from '../../../shared/auto-grow/auto-grow';
import { Clearable } from '../../../shared/clearable/clearable';

/**
 * "Vehicle info": photo of the registration document (carte grise) and a note under it.
 * - The dialog takes the full height; the image fills the space left (no scroll).
 * - Click on the image zooms in at that point; moving the mouse pans; click again zooms out.
 * - The note is saved while typing; Escape, a click on the backdrop or "Close" closes the dialog.
 */
@Component({
  selector: 'app-registration-dialog',
  imports: [TranslatePipe, AutoGrow, Clearable],
  templateUrl: './registration-dialog.html',
  styleUrl: './registration-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationDialog {
  /** Image URL, or null when the vehicle has no registration document yet */
  readonly image = input.required<string | null>();
  readonly note = input.required<string>();
  readonly noteChange = output<string>();
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly imageRef = viewChild<ElementRef<HTMLImageElement>>('image');

  protected readonly zoomed = signal(false);
  /** Zoom centre, as a CSS transform-origin */
  protected readonly origin = signal('50% 50%');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected toggleZoom(event: MouseEvent): void {
    // Keyboard activation (no pointer position): zoom on the centre
    if (event.detail === 0) this.origin.set('50% 50%');
    else this.pan(event, true);
    this.zoomed.update((zoomed) => !zoomed);
  }

  /** While zoomed, the zoom centre follows the mouse */
  protected pan(event: MouseEvent, force = false): void {
    const img = this.imageRef()?.nativeElement;
    if (!img || (!this.zoomed() && !force)) return;
    // Layout box of the image (not affected by the scale transform)
    const viewer = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - viewer.left - img.offsetLeft) / img.offsetWidth;
    const y = (event.clientY - viewer.top - img.offsetTop) / img.offsetHeight;
    const clamp = (value: number) => Math.min(100, Math.max(0, value * 100));
    this.origin.set(`${clamp(x)}% ${clamp(y)}%`);
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.closed.emit();
  }
}
