import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TranscriptService } from '../../core/services/transcript.service';
import { TranscriptPanel } from '../transcript-panel/transcript-panel';
import { isDesktop } from '../../core/utils/breakpoints';

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
  host: { '[class.no-transcript]': '!withTranscript()', '[class.no-sidebar]': '!withSidebar()' },
})
export class PanelsLayout {
  protected readonly transcript = inject(TranscriptService);

  /** The transcript panel on the right (not on every page) */
  readonly withTranscript = input(true);
  /** The side panel on the left (a page without a list, e.g. the shopping list, has none) */
  readonly withSidebar = input(true);

  /** Below the desktop width the side panels overlay the work area */
  private readonly isDesktop = isDesktop;
  readonly sidebarOpen = signal(this.isDesktop());
  /** Shared by every page (see TranscriptService.open) */
  readonly transcriptOpen = this.transcript.open;

  /** After choosing an item in the side panel: on small screens the panel covers the content */
  closeSidebarOnSmallScreens(): void {
    if (!this.isDesktop()) this.sidebarOpen.set(false);
  }

  protected closeOverlays(): void {
    this.sidebarOpen.set(false);
    this.transcriptOpen.set(false);
  }
}
