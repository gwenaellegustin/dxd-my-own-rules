import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import { TranscriptChange } from '../../core/models/transcript.model';
import { WorksheetStore } from '../../core/services/worksheet.store';
import { InvoiceStore } from '../../core/services/invoice.store';

/**
 * One change of an assistant answer in the transcript: the worksheet or invoice, the field or
 * line, previous → new value (Planned / Done with a check of the final status colour). The card
 * takes the background of the line once changed; clicking it shows the changed element.
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

  readonly change = input.required<TranscriptChange>();
  readonly show = output<void>();

  /** What a change is about: "Kia Ceed – Fabrice Favre" or the invoice number */
  protected targetLabel(): { key: string; params: Record<string, string> } {
    if (this.change().target.type === 'invoice') {
      return { key: 'transcript.invoice', params: { number: this.invoices.getById(this.change().target.id)?.number ?? '' } };
    }
    const worksheet = this.worksheets.getById(this.change().target.id);
    return { key: 'transcript.worksheet', params: { vehicle: worksheet?.vehicle ?? '', client: worksheet?.client ?? '' } };
  }
}
