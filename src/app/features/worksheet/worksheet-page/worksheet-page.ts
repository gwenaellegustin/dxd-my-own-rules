import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { WorksheetStore } from '../../../core/services/worksheet.store';
import { WorksheetSettingsStore } from '../../../core/services/worksheet-settings.store';
import { InvoiceStore } from '../../../core/services/invoice.store';
import { CarryOverRef, LineState, Worksheet } from '../../../core/models/worksheet.model';
import { TemplateSection } from '../../../core/models/worksheet-template.model';
import { Icon } from '../../../shared/icon/icon';
import { VehicleCardGroup, VehicleSidebar } from '../../../shared/vehicle-sidebar/vehicle-sidebar';
import { PanelsLayout } from '../../../layout/panels-layout/panels-layout';
import { ClientService } from '../../../core/services/client.service';
import { WorksheetDetails } from '../worksheet-details/worksheet-details';
import { TaskLine } from '../task-line/task-line';
import { CarryOverDialog, CarryOverGroup, CarryOverResult } from '../carry-over-dialog/carry-over-dialog';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { CarriedOverDialog, CarriedOverGroup, CarriedOverResult } from '../carried-over-dialog/carried-over-dialog';

@Component({
  selector: 'app-worksheet-page',
  imports: [
    TranslatePipe,
    Icon,
    PanelsLayout,
    VehicleSidebar,
    WorksheetDetails,
    TaskLine,
    CarryOverDialog,
    ConfirmDialog,
    CarriedOverDialog,
  ],
  templateUrl: './worksheet-page.html',
  styleUrl: './worksheet-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksheetPage {
  private readonly router = inject(Router);
  protected readonly store = inject(WorksheetStore);
  protected readonly settings = inject(WorksheetSettingsStore);
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

  /** Worksheets as cards of the left panel: open (on the lift), then invoiced (grey) */
  protected readonly cardGroups = computed<VehicleCardGroup[]>(() => {
    const byStatus = this.store.byStatus();
    const cards = (worksheets: Worksheet[]) =>
      worksheets.map(({ id, vehicle, client, date, status }) => ({
        id,
        vehicle,
        client,
        date,
        lifted: status === 'open',
        done: status === 'invoiced',
      }));
    return [
      { id: 'open', titleKey: null, cards: cards(byStatus.open) },
      { id: 'invoiced', titleKey: 'worksheets.groups.invoiced', cards: cards(byStatus.invoiced) },
    ];
  });

  constructor() {
    // A new worksheet left without any edit (another one shown, other page) is removed silently
    let shownId: string | undefined;
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (shownId && shownId !== id) this.store.discardIfUntouched(shownId);
        shownId = id;
      });
    });
    inject(DestroyRef).onDestroy(() => shownId && this.store.discardIfUntouched(shownId));

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

  /** Worksheet whose deletion is being confirmed */
  protected readonly deleting = signal<Worksheet | null>(null);

  /** "Kia Ceed – Fabrice Favre", for the confirmation */
  protected worksheetName(worksheet: Worksheet): string {
    return [worksheet.vehicle, worksheet.client].filter((part) => part.trim()).join(' – ');
  }

  /** Deleted (can be undone): the first open worksheet is shown instead */
  protected remove(worksheet: Worksheet): void {
    this.deleting.set(null);
    this.store.remove(worksheet.id);
    const next = this.store.byStatus().open[0] ?? this.store.worksheets()[0];
    this.router.navigate(next ? ['/worksheets', next.id] : ['/worksheets'], { replaceUrl: true });
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

  /** Lines of the worksheet kept by `keep`, grouped by section (sections without any are left out) */
  private lineGroups(worksheet: Worksheet, keep: (key: string) => boolean): CarryOverGroup[] {
    return (this.settings.templateFor(worksheet.kind)?.sections ?? [])
      .map((section) => ({
        sectionTitleKey: section.titleKey,
        items: section.lines.flatMap((line) =>
          this.store
            .lineInstanceIds(worksheet, line)
            .filter(keep)
            .map((key) => ({
              key,
              titleKey: line.titleKey,
              // "Other" lines have no title: show their free text (first field of the line)
              text: line.titleKey ? undefined : String(this.lineState(worksheet, key).values[line.fields?.[0]?.id ?? ''] ?? ''),
            })),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }

  /**
   * Lines carried over by previous interventions on the vehicle, proposed in a dialog as soon as
   * the worksheet has its client and vehicle (e.g. a new worksheet); null when there are none.
   * Item keys: `<source worksheet id>/<line key>`.
   */
  protected readonly carriedOver = computed<CarriedOverGroup[] | null>(() => {
    const worksheet = this.worksheet();
    const groups = (worksheet ? this.store.pendingCarryOver(worksheet) : []).flatMap((source) =>
      this.lineGroups(source, (key) => !!source.carryOver?.includes(key)).map((group) => ({
        ...group,
        date: source.date,
        items: group.items.map((item) => ({ ...item, key: `${source.id}/${item.key}` })),
      })),
    );
    return groups.length ? groups : null;
  });

  /** Closing the dialog imports nothing and deletes nothing; it is not shown again */
  protected answerCarriedOver(worksheet: Worksheet, { imported, deleted }: CarriedOverResult): void {
    this.store.answerCarryOver(worksheet.id, imported.map(carryOverRef), deleted.map(carryOverRef));
  }

  /** The invoice lists the done lines: without any, there is nothing to invoice */
  protected hasDoneLine(worksheet: Worksheet): boolean {
    return Object.values(worksheet.lines).some((state) => state.done);
  }

  /** Lines planned but not done, grouped by section; asked before creating the invoice */
  protected createInvoice(worksheet: Worksheet): void {
    if (!worksheet.client.trim() || !this.hasDoneLine(worksheet)) return;
    const groups = this.lineGroups(worksheet, (key) => {
      const state = this.lineState(worksheet, key);
      return state.planned && !state.done;
    });

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
    // Without a date, the worksheet is dated the day it is invoiced
    const date = worksheet.date || new Date().toLocaleDateString('sv');
    this.store.update(worksheet.id, { carryOver, date, status: 'invoiced' });
    this.carryOverGroups.set(null);
    const updated = this.store.getById(worksheet.id) ?? worksheet;
    const invoice = this.invoices.createFromWorksheet(
      updated,
      this.settings.allSections(),
      this.clients.byName(updated.client)?.rateId,
    );
    this.router.navigate(['/invoices', invoice.id]);
  }

  /** An invoiced worksheet can be reopened while its invoice is still open (not sent) */
  protected canReopen(worksheet: Worksheet): boolean {
    return this.invoices.latestFor(worksheet.id)?.status === 'open';
  }

  /** Editable again; its invoice is hidden (kept, shown again when invoicing again) */
  protected reopen(worksheet: Worksheet): void {
    if (!this.canReopen(worksheet)) return;
    this.invoices.hideOpenInvoiceOf(worksheet.id);
    this.store.reopen(worksheet.id);
  }

  /** Invoiced worksheet: its latest invoice */
  protected openInvoice(worksheet: Worksheet): void {
    const invoice = this.invoices.latestFor(worksheet.id);
    if (invoice) this.router.navigate(['/invoices', invoice.id]);
  }

  /**
   * Field edits (typing in a text field is grouped into one undo step). A new vehicle also sets
   * the kind of worksheet (car / motorcycle lines), and its client when none is chosen yet and
   * only one client owns that vehicle (its postponed items are then proposed).
   */
  protected updateWorksheet(id: string, changes: Partial<Omit<Worksheet, 'id' | 'lines'>>): void {
    const worksheet = this.store.getById(id);
    const vehicle = changes.vehicle;
    if (worksheet && vehicle !== undefined) {
      let client = changes.client ?? worksheet.client;
      const owners = this.clients.ownersOf(vehicle);
      if (!client.trim() && owners.length === 1) {
        client = owners[0].name;
        changes = { ...changes, client };
      }
      changes = { ...changes, kind: this.clients.kindOf(client, vehicle) };
    }
    this.store.update(id, changes);
  }

  protected updateLine(id: string, key: string, changes: Partial<LineState>): void {
    this.store.updateLine(id, key, changes);
  }
}

/** "ws-1003/labourOther~2" → its source worksheet and line key */
function carryOverRef(itemKey: string): CarryOverRef {
  const slash = itemKey.lastIndexOf('/');
  return { sourceId: itemKey.slice(0, slash), key: itemKey.slice(slash + 1) };
}
