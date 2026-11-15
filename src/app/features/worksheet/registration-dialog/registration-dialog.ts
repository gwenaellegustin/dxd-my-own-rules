import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AutoGrow } from '../../../shared/auto-grow/auto-grow';
import { Clearable } from '../../../shared/clearable/clearable';
import { ModalDialog } from '../../../shared/modal-dialog/modal-dialog';
import { Icon } from '../../../shared/icon/icon';

/**
 * "Vehicle info": photo of the registration document (carte grise) and a note under it.
 * - The dialog fits its content; the image is limited by the window height (no scroll).
 * - Click on the image zooms in at that point; moving the mouse pans; click again zooms out.
 * - Without a document, an area lets you drop or choose a photo. There is no backend yet: the
 *   photo is read in the browser (data URL) and kept in the worksheet until the page is reloaded.
 * - The note is saved while typing; Escape, a click on the backdrop or "Close" closes the dialog.
 */
@Component({
  selector: 'app-registration-dialog',
  imports: [TranslatePipe, AutoGrow, Clearable, ModalDialog, Icon],
  templateUrl: './registration-dialog.html',
  styleUrl: './registration-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationDialog {
  /** Image URL, or null when the vehicle has no registration document yet */
  readonly image = input.required<string | null>();
  readonly note = input.required<string>();
  readonly noteChange = output<string>();
  /** Photo chosen in the upload area, as a data URL */
  readonly imageChange = output<string>();
  readonly closed = output<void>();

  private readonly imageRef = viewChild<ElementRef<HTMLImageElement>>('image');

  protected readonly zoomed = signal(false);
  /** A file is dragged over the upload area */
  protected readonly dragOver = signal(false);
  /** Zoom centre, as a CSS transform-origin */
  protected readonly origin = signal('50% 50%');

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.readImage(input.files?.[0]);
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.readImage(event.dataTransfer?.files[0]);
  }

  /** Fake upload: the image is read in the browser and given to the worksheet */
  private readImage(file: File | undefined): void {
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => this.imageChange.emit(reader.result as string);
    reader.readAsDataURL(file);
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
}
