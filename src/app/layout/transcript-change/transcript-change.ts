import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { TranscriptChange } from '../../core/models/transcript.model';
import { WorksheetStore } from '../../core/services/worksheet.store';
import { InvoiceStore } from '../../core/services/invoice.store';
import { ChangeState, TranscriptRollbackService } from '../../core/services/transcript-rollback.service';

/**
 * One change of an assistant answer in the transcript: the worksheet or invoice, the field or
 * line, previous → new value (Planned / Done with a check of the final status colour). The card
 * takes the background of the line once changed; clicking it shows the changed element.
 * A small button in its bottom right corner rolls the change back, then applies it again.
 */
@Component({
  selector: 'app-transcript-change',
  imports: [NgTemplateOutlet, TranslatePipe, Icon],
  templateUrl: './transcript-change.html',
  styleUrl: './transcript-change.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TranscriptChangeCard {
  private readonly worksheets = inject(WorksheetStore);
  private readonly invoices = inject(InvoiceStore);
  private readonly rollback = inject(TranscriptRollbackService);

  readonly change = input.required<TranscriptChange>();
  readonly show = output<void>();

  /** Applied / rolled back… (null: no rollback button) */
  protected readonly state = computed<ChangeState | null>(() => this.rollback.state(this.change()));

  /** Planned / Done shown by the card: the previous one once rolled back */
  protected readonly status = computed(() =>
    this.state() === 'rolled-back' ? this.change().statusBefore : this.change().statusAfter,
  );

  protected readonly rollbackLabelKey = computed(() => {
    switch (this.state()) {
      case 'rolled-back':
        return 'transcript.reapply';
      case 'changed':
        return 'transcript.rollbackChanged';
      case 'locked':
        return 'transcript.rollbackLocked';
      default:
        return 'transcript.rollback';
    }
  });

  protected toggleRollback(): void {
    if (this.state() === 'rolled-back') this.rollback.reapply(this.change());
    else this.rollback.rollback(this.change());
  }

  protected targetIcon(): 'invoice' | 'tool' | 'cart' {
    const type = this.change().target.type;
    return type === 'invoice' ? 'invoice' : type === 'shopping-list' ? 'cart' : 'tool';
  }

  /** What a change is about: "Kia Ceed – Fabrice Favre" or the invoice number */
  protected targetLabel(): { key: string; params: Record<string, string> } {
    if (this.change().target.type === 'shopping-list') {
      return { key: 'transcript.shoppingList', params: {} };
    }
    if (this.change().target.type === 'invoice') {
      return { key: 'transcript.invoice', params: { number: this.invoices.getById(this.change().target.id)?.number ?? '' } };
    }
    const worksheet = this.worksheets.getById(this.change().target.id);
    return { key: 'transcript.worksheet', params: { vehicle: worksheet?.vehicle ?? '', client: worksheet?.client ?? '' } };
  }
}
