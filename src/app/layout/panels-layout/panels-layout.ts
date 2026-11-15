import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TranscriptService } from '../../core/services/transcript.service';
import { TranscriptPanel } from '../transcript-panel/transcript-panel';

/** Below this width the side panels overlay the work area (see _breakpoints.scss) */
const DESKTOP_QUERY = '(min-width: 1200px)';

/**
 * Page layout shared by the worksheet and invoice pages:
 * left side panel (projected with the `sidebar` attribute) | work area (other content) |
 * transcript panel (common to the whole app).
 *
 * The page binds its side panel to the layout state through a template reference:
 *   <app-panels-layout #layout>
 *     <app-vehicle-sidebar sidebar [open]="layout.sidebarOpen()" (openChange)="layout.sidebarOpen.set($event)" />
 *     …work area content…
 *   </app-panels-layout>
 */
@Component({
  selector: 'app-panels-layout',
  imports: [TranscriptPanel],
  templateUrl: './panels-layout.html',
  styleUrl: './panels-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.no-transcript]': '!withTranscript()' },
})
export class PanelsLayout {
  protected readonly transcript = inject(TranscriptService);

  /** The transcript panel on the right (not on every page) */
  readonly withTranscript = input(true);

  private readonly isDesktop = () => matchMedia(DESKTOP_QUERY).matches;
  readonly sidebarOpen = signal(this.isDesktop());
  readonly transcriptOpen = signal(false);

  /** After choosing an item in the side panel: on small screens the panel covers the content */
  closeSidebarOnSmallScreens(): void {
    if (!this.isDesktop()) this.sidebarOpen.set(false);
  }

  protected closeOverlays(): void {
    this.sidebarOpen.set(false);
    this.transcriptOpen.set(false);
  }
}
