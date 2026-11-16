import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AutoGrow } from '../auto-grow/auto-grow';
import { Clearable } from '../clearable/clearable';
import { ModalDialog } from '../modal-dialog/modal-dialog';
import { Icon } from '../icon/icon';
import { Vehicle, VehicleChanges, VehicleKind } from '../../core/models/client.model';

/**
 * "Vehicle info" (vehicle file, opened from a worksheet or a client):
 * - At the top: brand / model, plate, car or motorcycle, owner (read-only).
 * - Then the photo of the registration document (carte grise) and a note under it.
 * - The dialog fits its content; the image is limited by the window height (no scroll).
 * - Click on the image zooms in at that point; moving the mouse pans; click again zooms out.
 * - Without a document, an area lets you drop or choose a photo. There is no backend yet: the
 *   photo is read in the browser (data URL) and kept in the vehicle file until the page is reloaded.
 * - Every field is saved while typing (`vehicleChange`); a new brand / model is also reported once
 *   the field is left (`renamed`), so that the worksheets of the vehicle follow; Escape, a click on the backdrop or "Close" closes the dialog.
 */
@Component({
  selector: 'app-vehicle-dialog',
  imports: [TranslatePipe, AutoGrow, Clearable, ModalDialog, Icon],
  templateUrl: './vehicle-dialog.html',
  styleUrl: './vehicle-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleDialog {
  readonly vehicle = input.required<Vehicle>();
  /** Name of the client owning the vehicle */
  readonly owner = input.required<string>();
  /** View only (vehicle of an invoiced worksheet): no upload, fields disabled */
  readonly locked = input(false);
  readonly vehicleChange = output<VehicleChanges>();
  /** Brand / model changed (emitted when the field is left) */
  readonly renamed = output<{ from: string; to: string }>();
  readonly closed = output<void>();

  protected readonly kinds: VehicleKind[] = ['car', 'motorcycle'];

  /** Brand / model when its field got the focus */
  private nameBefore = '';

  protected onNameFocus(event: Event): void {
    this.nameBefore = (event.target as HTMLInputElement).value;
  }

  protected onNameCommit(event: Event): void {
    const to = (event.target as HTMLInputElement).value;
    if (this.nameBefore !== to) this.renamed.emit({ from: this.nameBefore, to });
    this.nameBefore = to;
  }

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

  /** Fake upload: the image is read in the browser and given to the vehicle file */
  private readImage(file: File | undefined): void {
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => this.vehicleChange.emit({ registrationImage: reader.result as string });
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
