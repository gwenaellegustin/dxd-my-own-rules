import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { TranscriptService } from '../../../core/services/transcript.service';
import { LineState, Worksheet } from '../../../core/models/worksheet.model';
import { TemplateSection } from '../../../core/models/worksheet-template.model';
import { Icon } from '../../../shared/icon/icon';
import { WorksheetSidebar } from '../worksheet-sidebar/worksheet-sidebar';
import { TranscriptPanel } from '../transcript-panel/transcript-panel';
import { WorksheetDetails } from '../worksheet-details/worksheet-details';
import { TaskLine } from '../task-line/task-line';
import { CarryOverDialog, CarryOverGroup } from '../carry-over-dialog/carry-over-dialog';

/** Below this width the side panels overlay the work area (see _breakpoints.scss) */
const DESKTOP_QUERY = '(min-width: 1200px)';

@Component({
  selector: 'app-worksheet-page',
  imports: [TranslatePipe, Icon, WorksheetSidebar, TranscriptPanel, WorksheetDetails, TaskLine, CarryOverDialog],
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
  /** Ids of the collapsed sections (Labour, Parts…); kept when switching worksheet */
  private readonly collapsedSections = signal<ReadonlySet<string>>(new Set());
  /** Content of the "carry over" dialog; null when the dialog is closed */
  protected readonly carryOverGroups = signal<CarryOverGroup[] | null>(null);

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

  protected isCollapsed(sectionId: string): boolean {
    return this.collapsedSections().has(sectionId);
  }

  protected toggleSection(sectionId: string): void {
    this.collapsedSections.update((current) => {
      const next = new Set(current);
      if (!next.delete(sectionId)) next.add(sectionId);
      return next;
    });
  }

  /** Shown next to a collapsed section title */
  protected sectionProgress(worksheet: Worksheet, section: TemplateSection): { planned: number; done: number } {
    const states = section.lines
      .flatMap((line) => this.store.lineInstanceIds(worksheet, line))
      .map((key) => this.lineState(worksheet, key));
    return {
      planned: states.filter((state) => state.planned && !state.done).length,
      done: states.filter((state) => state.done).length,
    };
  }

  /** Lines planned but not done, grouped by section; asked before creating the invoice */
  protected createInvoice(worksheet: Worksheet): void {
    const groups = (this.store.template()?.sections ?? [])
      .map((section) => ({
        sectionTitleKey: section.titleKey,
        items: section.lines.flatMap((line) =>
          this.store
            .lineInstanceIds(worksheet, line)
            .filter((key) => {
              const state = this.lineState(worksheet, key);
              return state.planned && !state.done;
            })
            .map((key) => ({
              key,
              titleKey: line.titleKey,
              // "Other" lines have no title: show their free text
              text: line.titleKey ? undefined : String(this.lineState(worksheet, key).values['text'] ?? ''),
            })),
        ),
      }))
      .filter((group) => group.items.length > 0);

    if (groups.length) this.carryOverGroups.set(groups);
    else this.confirmCarryOver(worksheet, []);
  }

  /** Keeps the items to carry over to the next intervention, then opens the invoice */
  protected confirmCarryOver(worksheet: Worksheet, keys: string[]): void {
    this.store.update(worksheet.id, { carryOver: keys });
    this.carryOverGroups.set(null);
    this.router.navigate(['/invoices']);
  }

  protected closeOverlays(): void {
    this.sidebarOpen.set(false);
    this.transcriptOpen.set(false);
  }
}
