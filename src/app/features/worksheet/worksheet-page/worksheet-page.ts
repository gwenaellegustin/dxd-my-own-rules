import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { InvoiceStore } from '../../../core/services/invoice.store';
import { LineState, Worksheet } from '../../../core/models/worksheet.model';
import { TemplateSection } from '../../../core/models/worksheet-template.model';
import { Icon } from '../../../shared/icon/icon';
import { VehicleCardGroup, VehicleSidebar } from '../../../shared/vehicle-sidebar/vehicle-sidebar';
import { PanelsLayout } from '../../../layout/panels-layout/panels-layout';
import { ClientService } from '../../../core/services/client.service';
import { WorksheetDetails } from '../worksheet-details/worksheet-details';
import { TaskLine } from '../task-line/task-line';
import { CarryOverDialog, CarryOverGroup, CarryOverResult } from '../carry-over-dialog/carry-over-dialog';

@Component({
  selector: 'app-worksheet-page',
  imports: [TranslatePipe, Icon, PanelsLayout, VehicleSidebar, WorksheetDetails, TaskLine, CarryOverDialog],
  templateUrl: './worksheet-page.html',
  styleUrl: './worksheet-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class WorksheetPage {
  private readonly router = inject(Router);
  protected readonly store = inject(WorksheetStore);
  private readonly invoices = inject(InvoiceStore);
  private readonly clients = inject(ClientService);
  private readonly layout = viewChild.required(PanelsLayout);

  /** Route parameter `:id` (bound via withComponentInputBinding) */
  readonly id = input<string>();

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

  /** Worksheets as cards of the left panel: open (on the lift), then invoiced */
  protected readonly cardGroups = computed<VehicleCardGroup[]>(() => {
    const byStatus = this.store.byStatus();
    const cards = (worksheets: Worksheet[]) =>
      worksheets.map(({ id, vehicle, client, date, status }) => ({ id, vehicle, client, date, lifted: status === 'open' }));
    return [
      { id: 'open', titleKey: null, cards: cards(byStatus.open) },
      { id: 'invoiced', titleKey: 'worksheets.groups.invoiced', cards: cards(byStatus.invoiced) },
    ];
  });

  constructor() {
    this.store.load();
    // Hourly rates are needed to create an invoice
    this.invoices.load();

    // Without a valid id, show the first open worksheet
    effect(() => {
      if (!this.store.loaded() || this.worksheet()) return;
      const first = this.store.byStatus().open[0] ?? this.store.worksheets()[0];
      if (first) this.router.navigate(['/worksheets', first.id], { replaceUrl: true });
    });
  }

  protected select(id: string): void {
    this.router.navigate(['/worksheets', id]);
    this.layout().closeSidebarOnSmallScreens();
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
    const groups = (this.store.templateFor(worksheet.kind)?.sections ?? [])
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
              // "Other" lines have no title: show their free text (first field of the line)
              text: line.titleKey ? undefined : String(this.lineState(worksheet, key).values[line.fields?.[0]?.id ?? ''] ?? ''),
            })),
        ),
      }))
      .filter((group) => group.items.length > 0);

    if (groups.length) this.carryOverGroups.set(groups);
    else this.confirmCarryOver(worksheet, { carryOver: [], done: [] });
  }

  /**
   * Marks the lines checked "Done" in the dialog and keeps the items to carry over to the next
   * intervention; then creates the open invoice of the done lines (the worksheet becomes
   * "invoiced") and opens it
   */
  protected confirmCarryOver(worksheet: Worksheet, { carryOver, done }: CarryOverResult): void {
    for (const key of done) this.store.updateLine(worksheet.id, key, { done: true });
    this.store.update(worksheet.id, { carryOver, status: 'invoiced' });
    this.carryOverGroups.set(null);
    const updated = this.store.getById(worksheet.id) ?? worksheet;
    const invoice = this.invoices.createFromWorksheet(
      updated,
      this.store.allSections(),
      this.clients.byName(updated.client)?.rateId,
    );
    this.router.navigate(['/invoices', invoice.id]);
  }

  /** Invoiced worksheet: its latest invoice */
  protected openInvoice(worksheet: Worksheet): void {
    const invoice = this.invoices.latestFor(worksheet.id);
    if (invoice) this.router.navigate(['/invoices', invoice.id]);
  }

  /**
   * Field edits (typing in a text field is grouped into one undo step); a new vehicle also sets
   * the kind of worksheet (car / motorcycle lines)
   */
  protected updateWorksheet(id: string, changes: Partial<Omit<Worksheet, 'id' | 'lines'>>): void {
    const worksheet = this.store.getById(id);
    if (worksheet && changes.vehicle !== undefined) {
      changes = { ...changes, kind: this.clients.kindOf(changes.client ?? worksheet.client, changes.vehicle) };
    }
    this.store.update(id, changes, { typing: isTextEditing() });
  }

  protected updateLine(id: string, key: string, changes: Partial<LineState>): void {
    this.store.updateLine(id, key, changes, { typing: isTextEditing() });
  }

  /**
   * Ctrl+Z undoes the last edit (text, checkbox, radio, damage mark, added / removed line),
   * Ctrl+Y or Ctrl+Shift+Z redoes it (Cmd on macOS). The browser's own undo of text fields is
   * replaced, so the fields and the worksheet data always stay in sync.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.store.undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.store.redo();
    }
  }
}

/** True while the user types in a text field (not a checkbox, radio or button) */
function isTextEditing(): boolean {
  const element = document.activeElement;
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(element.type);
}
