import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { TranscriptService } from '../../../core/services/transcript.service';
import { LineState, Worksheet } from '../../../core/models/worksheet.model';
import { WorksheetSidebar } from '../worksheet-sidebar/worksheet-sidebar';
import { TranscriptPanel } from '../transcript-panel/transcript-panel';
import { WorksheetDetails } from '../worksheet-details/worksheet-details';
import { TaskLine } from '../task-line/task-line';

/** Below this width the side panels overlay the work area (see _breakpoints.scss) */
const DESKTOP_QUERY = '(min-width: 1200px)';

@Component({
  selector: 'app-worksheet-page',
  imports: [TranslatePipe, WorksheetSidebar, TranscriptPanel, WorksheetDetails, TaskLine],
  templateUrl: './worksheet-page.html',
  styleUrl: './worksheet-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetPage {
  private readonly router = inject(Router);
  protected readonly store = inject(WorksheetStore);
  protected readonly transcript = inject(TranscriptService);

  /** Route parameter `:id` (bound via withComponentInputBinding) */
  readonly id = input<string>();

  private readonly isDesktop = () => matchMedia(DESKTOP_QUERY).matches;
  protected readonly sidebarOpen = signal(this.isDesktop());
  protected readonly transcriptOpen = signal(false);

  protected readonly worksheet = computed(() => this.store.getById(this.id() ?? null));
  /** Wrapped in an array so the form is re-created when switching worksheet */
  protected readonly displayed = computed(() => {
    const worksheet = this.worksheet();
    return worksheet ? [worksheet] : [];
  });

  constructor() {
    this.store.load();

    // Without a valid id, show the first open worksheet
    effect(() => {
      if (!this.store.loaded() || this.worksheet()) return;
      const first = this.store.byStatus().open[0] ?? this.store.worksheets()[0];
      if (first) this.router.navigate(['/worksheets', first.id], { replaceUrl: true });
    });
  }

  protected select(id: string): void {
    this.router.navigate(['/worksheets', id]);
    if (!this.isDesktop()) this.sidebarOpen.set(false);
  }

  protected create(): void {
    this.select(this.store.create().id);
  }

  protected lineState(worksheet: Worksheet, lineId: string): LineState {
    return this.store.lineState(worksheet, lineId);
  }

  protected closeOverlays(): void {
    this.sidebarOpen.set(false);
    this.transcriptOpen.set(false);
  }
}
